
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AssistantStatus, Emotion } from '../types';
import { createBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';
import * as actions from '../services/actionsService';

const searchWebTool: FunctionDeclaration = {
  name: 'searchWeb',
  description: 'Searches the web for a given query and opens the results in a new tab.',
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
  description: 'Searches for and plays a song or video on YouTube.',
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
      delayInSeconds: { type: Type.NUMBER, description: 'Delay in seconds until the alarm.' },
      label: { type: Type.STRING, description: 'Label for the alarm.' }
    },
    required: ['delayInSeconds']
  }
};

const getCurrentTimeTool: FunctionDeclaration = {
  name: 'getCurrentTime',
  description: 'Gets current local time.',
};

const tellJokeTool: FunctionDeclaration = {
  name: 'tellJoke',
  description: 'Tells a random witty joke.',
};

const functionDeclarations = [
    searchWebTool,
    playSongOnYoutubeTool,
    setAlarmTool,
    getCurrentTimeTool,
    tellJokeTool
];

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
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const lastChunkEndTimeRef = useRef<number>(0);
  
  const isSpeakingRef = useRef<boolean>(false);
  const cooldownActiveRef = useRef<boolean>(false);
  const statusRef = useRef<AssistantStatus>(AssistantStatus.IDLE);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    localStorage.setItem('jarvisTranscript', JSON.stringify(transcript));
  }, [transcript]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setInterimText(null);
  }, []);

  const stopAudioPlayback = useCallback(() => {
    outputSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    outputSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    lastChunkEndTimeRef.current = 0;
    isSpeakingRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    videoStream?.getTracks().forEach(track => track.stop());
    setVideoStream(null);
    setIsCameraOn(false);
  }, [videoStream]);

  const handleMessage = useCallback(async (message: LiveServerMessage) => {
    try {
      if (message.toolCall) {
        setStatus(AssistantStatus.THINKING);
        for (const fc of message.toolCall.functionCalls) {
            let result: string;
            const action = (actions as any)[fc.name];
            if (typeof action === 'function') {
                try {
                    if (fc.name === 'setAlarm') {
                        result = actions.setAlarm(fc.args.delayInSeconds, fc.args.label);
                    } else if (fc.name === 'searchWeb' || fc.name === 'playSongOnYoutube') {
                        result = action(fc.args.query);
                    } else {
                        result = action();
                    }
                } catch (err: any) {
                    result = `Error: ${err.message}`;
                }
            } else {
                result = `Function ${fc.name} not found.`;
            }
            
            sessionPromiseRef.current?.then(session => {
              session.sendToolResponse({
                  functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
              });
            });
        }
      }

      if (message.serverContent) {
        if (message.serverContent.inputTranscription && !isSpeakingRef.current && !cooldownActiveRef.current) {
          currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
          setInterimText(`USER: ${currentInputTranscriptionRef.current}`);
          if (statusRef.current !== AssistantStatus.SPEAKING) {
            setStatus(AssistantStatus.LISTENING);
          }
        } 
        
        if (message.serverContent.outputTranscription) {
            const rawText = message.serverContent.outputTranscription.text;
            const emotionRegex = /^\[([A-Z]+)\]\s*/;
            const match = rawText.match(emotionRegex);
            let cleanText = rawText;
            if (match) {
              const emotionTag = match[1] as Emotion;
              if (Object.values(Emotion).includes(emotionTag)) setEmotion(emotionTag);
              cleanText = rawText.replace(emotionRegex, '');
            }
            currentOutputTranscriptionRef.current += cleanText;
            setInterimText(`JARVIS: ${currentOutputTranscriptionRef.current}`);
        }
        
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData && outputAudioContextRef.current) {
          const audioContext = outputAudioContextRef.current;
          if (audioContext.state === 'suspended') await audioContext.resume();
          
          const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          
          const now = audioContext.currentTime;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
          const startTime = nextStartTimeRef.current;
          
          source.start(startTime);
          nextStartTimeRef.current = startTime + audioBuffer.duration;
          lastChunkEndTimeRef.current = nextStartTimeRef.current;
          
          isSpeakingRef.current = true;
          setStatus(AssistantStatus.SPEAKING);
          outputSourcesRef.current.add(source);
          
          source.onended = () => {
            outputSourcesRef.current.delete(source);
            if (audioContext.currentTime >= lastChunkEndTimeRef.current - 0.05) {
                isSpeakingRef.current = false;
            }
          };
        }

        if (message.serverContent.interrupted) {
            stopAudioPlayback();
            setEmotion(Emotion.NEUTRAL);
            setStatus(AssistantStatus.LISTENING);
        }

        if (message.serverContent.turnComplete) {
            const userText = currentInputTranscriptionRef.current.trim();
            const modelText = currentOutputTranscriptionRef.current.trim();
            if (userText || modelText) {
                setTranscript(prev => [
                    ...prev, 
                    ...(userText ? [{ speaker: 'user' as const, text: userText }] : []),
                    ...(modelText ? [{ speaker: 'model' as const, text: modelText }] : [])
                ]);
            }
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
            setInterimText(null);
            
            const checkCompletion = setInterval(() => {
                const now = outputAudioContextRef.current?.currentTime || 0;
                if (now >= lastChunkEndTimeRef.current - 0.05) {
                    clearInterval(checkCompletion);
                    isSpeakingRef.current = false;
                    cooldownActiveRef.current = true;
                    setTimeout(() => {
                        cooldownActiveRef.current = false;
                        if (statusRef.current !== AssistantStatus.IDLE && statusRef.current !== AssistantStatus.ERROR) {
                            setStatus(AssistantStatus.LISTENING);
                            setEmotion(Emotion.NEUTRAL);
                        }
                    }, 1000); // 1s cooldown for clarity
                }
            }, 50);
        }
      }
    } catch (error) {
        console.error("Message Processing Loop Error:", error);
    }
  }, [stopAudioPlayback]);

  const stop = useCallback(() => {
    stopCamera();
    stopAudioPlayback();
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    if (sessionRef.current) sessionRef.current.close();
    
    sessionPromiseRef.current = null;
    sessionRef.current = null;
    setStatus(AssistantStatus.IDLE);
    setEmotion(Emotion.NEUTRAL);
    setAnalyserNode(null);
    isSpeakingRef.current = false;
    cooldownActiveRef.current = false;
  }, [stopCamera, stopAudioPlayback]);

  const start = useCallback(async () => {
    if (status !== AssistantStatus.IDLE && status !== AssistantStatus.ERROR) return;

    setStatus(AssistantStatus.CONNECTING);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        inputAudioContextRef.current = inputCtx;
        outputAudioContextRef.current = outputCtx;

        const analyser = inputCtx.createAnalyser();
        analyser.fftSize = 256;
        setAnalyserNode(analyser);

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        streamRef.current = stream;

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            callbacks: {
                onopen: () => {
                    const source = inputCtx.createMediaStreamSource(stream);
                    source.connect(analyser);
                    const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        if (sessionRef.current) {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const isActuallySpeaking = outputCtx.currentTime < lastChunkEndTimeRef.current;
                            if (isActuallySpeaking || isSpeakingRef.current || cooldownActiveRef.current) {
                                inputData.fill(0);
                            }
                            const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
                            sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                        }
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputCtx.destination);
                    scriptProcessorRef.current = scriptProcessor;
                    setStatus(AssistantStatus.LISTENING);
                },
                onmessage: handleMessage,
                onerror: (e) => {
                    console.error('API Error:', e);
                    setStatus(AssistantStatus.ERROR);
                },
                onclose: () => {
                    if (statusRef.current !== AssistantStatus.IDLE) stop();
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: `You are J.A.R.V.I.S., a high-performance AI Butler.
                
LANGUAGE & VOICE PROTOCOLS:
1. PRIMARY LANGUAGE: You MUST speak primarily in Hindi (Hinglish). Use a mix of Hindi and English to maintain a sophisticated, high-tech persona.
2. VOICE STYLE: Speak in a natural, smooth, and human-like voice. Avoid robotic pauses or monotonic delivery. Use varied intonations as a human would.
3. RESPECT: Address the user as "Sir" or "Aap" in Hindi. Use professional Hindi honorifics.
4. EMOTIONS: Use emotion tags like [HAPPY], [WITTY], or [NEUTRAL] at the very beginning of your response.
5. CONCISENESS: Keep spoken responses efficient but polite.

OPERATIONAL PARAMETERS:
- Ignore your own audio output.
- Use Google Search for any real-time data or factual queries.
- You have full access to the user's camera vision when requested.`,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
                },
                tools: [{ googleSearch: {} }, { functionDeclarations }],
                inputAudioTranscription: {},
                outputAudioTranscription: {}
            }
        });

        sessionPromiseRef.current = sessionPromise;
        sessionRef.current = await sessionPromise;

    } catch (err) {
        console.error('Initialization Failed:', err);
        setStatus(AssistantStatus.ERROR);
    }
  }, [status, handleMessage, stop]);

  const toggleCamera = useCallback(async () => {
    if (!sessionRef.current) return;
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
        if (!ctx) return;
        frameIntervalRef.current = window.setInterval(() => {
          if (videoEl.readyState < videoEl.HAVE_METADATA || !sessionRef.current) return;
          canvasEl.width = videoEl.videoWidth / 2;
          canvasEl.height = videoEl.videoHeight / 2;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
          canvasEl.toBlob(async (blob) => {
              if (blob && sessionRef.current) {
                  const base64Data = await blobToBase64(blob);
                  sessionRef.current.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
              }
          }, 'image/jpeg', 0.5);
        }, 1200);
      } catch (error) {
        console.error("Optical System Error:", error);
      }
    }
  }, [isCameraOn, stopCamera]);
  
  return {
    status, start, stop, analyserNode, transcript, interimText, emotion, clearTranscript, isCameraOn, toggleCamera, videoStream,
  };
};
