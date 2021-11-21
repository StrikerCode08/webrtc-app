import './style.css'

// Import the functions you need from the SDKs you need
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { initializeApp } from "firebase/app"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAFGZ7JK-fTmwb20SNSXuiVui7w-KOQVpk",
  authDomain: "webrt-49da5.firebaseapp.com",
  projectId: "webrt-49da5",
  storageBucket: "webrt-49da5.appspot.com",
  messagingSenderId: "283113671623",
  appId: "1:283113671623:web:9e8a07cf6604b0c49ca7e2",
  measurementId: "G-GF6RTS79H6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


 if(!firebase.apps.length){
   firebase.initializeApp(firebaseConfig);
 }

const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State

let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');


// Setup media sources

webcamButton.onclick = async () =>{
  localStream = await navigator.mediaDevices.getUserMedia({video : true , audio:true})
  remoteStream = new MediaStream();

// Push tracks from local stream to peer
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  pc.ontrack = event =>{
    event.streams[0].getTracks().forEach(track =>{
      remoteStream.addTrack(track);
    });
  }

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
}

//Create An Offer 

callButton.onclick = async() =>{
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get Candidates for Caller and save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create Offer 
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };
  await callDoc.set({ offer })

  //Listen for remote answer
  callDoc.onSnapshot((snapshot) =>{
    const data = snapshot.data();
    if(!pc.currentRemoteDescription && data?.answer){
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });
 // When Answered add candidate to peer connection
 answerCandidates.onSnapshot(snapshot =>{
   snapshot.docChanges().forEach(change =>{
     if(change.type === 'added'){
       const candidate = new RTCIceCandidate(change.doc.data());
       pc.addIceCandidate(candidate);
     }
   });
 });
}

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};