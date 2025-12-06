
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AssistantStatus, Emotion } from '../types';
import { createBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';
import * as actions from '../services/actionsService';

// Tools definitions
const searchWebTool: FunctionDeclaration = {
  name: 'searchWeb',
  description: 'Searches the web for a given query and opens the results in a new tab. Use this when the user explicitly asks to "open" a search or see results.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search query' }
    },
    required: ['query']
  }
};

const playSongOnYoutubeTool: FunctionDeclaration = {
  name: 'playSongOnYoutube',
  description: 'Searches for a song or video on YouTube and opens it in a new tab.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The song or artist to search for' }
    },
    required: ['query']
  }
};

const setAlarmTool: FunctionDeclaration = {
  name: 'setAlarm',
  description: 'Sets an alarm or timer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      delayInSeconds: { type: Type.NUMBER, description: 'The delay in seconds until the alarm goes off.' },
      label: { type: Type.STRING, description: 'A label for the alarm.' }
    },
    required: ['delayInSeconds']
  }
};

const getCurrentTimeTool: FunctionDeclaration = {
  name: 'getCurrentTime',
  description: 'Gets the current time.',
};

const tellJokeTool: FunctionDeclaration = {
  name: 'tellJoke',
  description: 'Tells a random joke.',
};

const functionDeclarations = [
    searchWebTool,
    playSongOnYoutubeTool,
    setAlarmTool,
    getCurrentTimeTool,
    tellJokeTool
];

// Types
type TranscriptEntry = { speaker: 'user' | 'model'; text: string };

export const useJarvis = () => {
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.IDLE);
  const [emotion, setEmotion] = useState<Emotion>(Emotion.NEUTRAL);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() => {
    try {
      const saved = localStorage.getItem('jarvisTranscript');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Could not load transcript from localStorage', error);
      return [];
    }
  });
  const [interimText, setInterimText] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);


  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const videoStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    videoStreamRef.current = videoStream;
  }, [videoStream]);

  useEffect(() => {
    try {
      localStorage.setItem('jarvisTranscript', JSON.stringify(transcript));
    } catch (error) {
      console.error('Could not save transcript to localStorage', error);
    }
  }, [transcript]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  const stopAudioPlayback = () => {
    outputSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    outputSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const stopCamera = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    videoStreamRef.current?.getTracks().forEach(track => track.stop());
    setVideoStream(null);
    setIsCameraOn(false);
  }, []);
  
  const toggleCamera = useCallback(async () => {
    if (!sessionPromiseRef.current) {
      console.log("Cannot toggle camera, session not active.");
      return;
    }

    if (isCameraOn) {
      stopCamera();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setVideoStream(stream);
        setIsCameraOn(true);

        const videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.play();

        const canvasEl = document.createElement('canvas');
        const ctx = canvasEl.getContext('2d');
        if (!ctx) {
            console.error("Could not get canvas context");
            return;
        }

        frameIntervalRef.current = window.setInterval(() => {
          if (videoEl.readyState < videoEl.HAVE_METADATA) return;

          canvasEl.width = videoEl.videoWidth;
          canvasEl.height = videoEl.videoHeight;
          ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
          
          canvasEl.toBlob(
              async (blob) => {
                  const currentSessionPromise = sessionPromiseRef.current;
                  if (blob && currentSessionPromise) {
                      try {
                        const base64Data = await blobToBase64(blob);
                        // Check if session is still the same
                        if (sessionPromiseRef.current === currentSessionPromise) {
                            currentSessionPromise.then(session => {
                                session.sendRealtimeInput({
                                media: { data: base64Data, mimeType: 'image/jpeg' }
                                });
                            }).catch(e => {
                                // Session might be closed or network error, ignore for stream
                            });
                        }
                      } catch (error) {
                          console.debug("Error processing video frame", error);
                      }
                  }
              },
              'image/jpeg',
              0.8 // JPEG quality
          );
        }, 200); // 5 FPS
        
      } catch (error) {
        console.error("Error accessing camera:", error);
        setStatus(AssistantStatus.ERROR);
      }
    }
  }, [isCameraOn, stopCamera]);
  
  const handleMessage = async (message: LiveServerMessage) => {
    try {
      if (message.toolCall) {
        setStatus(AssistantStatus.THINKING);
        setEmotion(Emotion.THINKING);

        for (const fc of message.toolCall.functionCalls) {
            let result: string;
            // @ts-ignore
            const action = actions[fc.name as keyof typeof actions];

            if (typeof action === 'function') {
                try {
                    // @ts-ignore
                    result = action(...Object.values(fc.args));
                } catch (err: any) {
                    console.error(`Error executing tool ${fc.name}:`, err);
                    result = `Error executing tool: ${err.message}`;
                }
            } else {
                console.error(`Unknown function call: ${fc.name}`);
                result = `I am not familiar with the function ${fc.name}.`;
            }
            
            sessionRef.current?.sendToolResponse({
                functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: { result: result },
                }
            });
        }
      }

      if (message.serverContent) {
        if (message.serverContent.inputTranscription) {
          const text = message.serverContent.inputTranscription.text;
          currentInputTranscriptionRef.current += text;
          setInterimText(currentInputTranscriptionRef.current);
          setStatus(AssistantStatus.LISTENING);
          setEmotion(Emotion.NEUTRAL);
        } else if (message.serverContent.outputTranscription) {
            const rawText = message.serverContent.outputTranscription.text;
            const emotionRegex = /^\[([A-Z]+)\]\s*/;
            const match = rawText.match(emotionRegex);
  
            let cleanText = rawText;
            if (match) {
              const emotionTag = match[1] as Emotion;
              if (Object.values(Emotion).includes(emotionTag)) {
                setEmotion(emotionTag);
              }
              cleanText = rawText.replace(emotionRegex, '');
            }
            
            currentOutputTranscriptionRef.current += cleanText;
            setInterimText(currentOutputTranscriptionRef.current);
            setStatus(AssistantStatus.SPEAKING);
        }
        
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData && outputAudioContextRef.current) {
          const audioContext = outputAudioContextRef.current;
          if (audioContext.state === 'suspended') {
              await audioContext.resume();
          }
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
          const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.addEventListener('ended', () => {
            outputSourcesRef.current.delete(source);
          });
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          outputSourcesRef.current.add(source);
        }

        if (message.serverContent.interrupted) {
          stopAudioPlayback();
        }

        if (message.serverContent.turnComplete) {
            const fullInput = currentInputTranscriptionRef.current.trim();
            const fullOutput = currentOutputTranscriptionRef.current.trim();
        
            setTranscript(prev => {
                const newHistory = [...prev];
                if (fullInput) newHistory.push({ speaker: 'user', text: fullInput });
                if (fullOutput) newHistory.push({ speaker: 'model', text: fullOutput });
                return newHistory;
            });
            
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
            setInterimText(null);
            setEmotion(Emotion.NEUTRAL);
        }
      }
    } catch (error) {
        console.error("Error processing message:", error);
        // Do not set error status immediately as it might be a transient frame error
    }
  };

  const stop = useCallback(async () => {
    try {
      stopCamera();

      setStatus(AssistantStatus.IDLE);
      setEmotion(Emotion.NEUTRAL);
      setInterimText(null);
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';

      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      
      if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
         await inputAudioContextRef.current.close().catch(console.error);
      }
      if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
         await outputAudioContextRef.current.close().catch(console.error);
      }
      
      if (sessionRef.current) {
          // Note: session.close() is synchronous in some versions, asynchronous in others, 
          // but safely wrapping it is good practice.
          try {
             sessionRef.current.close();
          } catch (e) {
             console.log("Error closing session", e);
          }
      }
      
      inputAudioContextRef.current = null;
      outputAudioContextRef.current = null;
      sessionRef.current = null;
      sessionPromiseRef.current = null;
    } catch (error) {
        console.error("Error during stop:", error);
    } finally {
        setAnalyserNode(null);
        stopAudioPlayback();
    }
  }, [stopCamera]);
  
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const start = useCallback(async () => {
    // Ensure previous session is fully cleaned up
    await stop();
    
    // Slight delay to ensure OS releases audio resources to prevent "Network Error" on quick toggles
    await new Promise(resolve => setTimeout(resolve, 500));

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      setStatus(AssistantStatus.LISTENING);
      setEmotion(Emotion.NEUTRAL);
      
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputAudioContext;

      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const source = inputAudioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const analyser = inputAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!inputAudioContextRef.current) return;
            
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(e => {
                   // Ignore temporary sending errors during connection/disconnection
              });
            };

            source.connect(scriptProcessor);
            
            // Connect to a mute node to avoid feedback but keep the graph alive for Chrome
            const muteNode = inputAudioContextRef.current.createGain();
            muteNode.gain.value = 0;
            scriptProcessor.connect(muteNode);
            muteNode.connect(inputAudioContextRef.current.destination);
          },
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            console.error('API Error:', e);
            setStatus(AssistantStatus.ERROR);
            stop(); // Clean up on error
          },
          onclose: (e: CloseEvent) => {
            console.log('Session closed', e);
            stop();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          tools: [
            { functionDeclarations }
          ],
          systemInstruction: `You are JARVIS, but with a friendly, desi twist. You are a smart assistant who speaks in "Delhi style" Hinglish (Hindi + English). You are helpful, futuristic, but your vibe is like a helpful friend from Delhi.

**Core Directives:**
1.  **Persona:** Friendly, smart, energetic Delhiite. Use slang like "Bhai", "Yaar", "Scene", "Mast", "Bindaas", "Guru".
2.  **Language:** Speak in Hinglish (Hindi mixed with English). Keep it conversational and natural.
3.  **Capabilities:**
    *   **Answer Questions:** You are knowledgeable. If you need to show something from the web, use the 'searchWeb' tool to open it for the user.
    *   **Vision:** You can see the user's camera feed. Analyze it when relevant.
    *   **Actions:** Use your tools freely. If asked to play music, use 'playSongOnYoutube'.
4.  **Protocol:**
    *   Start responses with an emotion tag: [NEUTRAL], [THINKING], [HAPPY], [WITTY], [HELPFUL].
    *   Be concise. Do not ramble.
    *   Do not ask "Is there anything else?".
    *   Example: "[HAPPY] Arre bhai, bilkul! Main abhi check karta hoon."
5.  **System Status:**
    *   You are online and fully operational.
`
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('Failed to start assistant:', error);
      setStatus(AssistantStatus.ERROR);
      stop();
    }
  }, [stop]);

  return { status, start, stop, analyserNode, transcript, interimText, emotion, clearTranscript, isCameraOn, toggleCamera, videoStream };
};
