'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Web Speech API types (not in standard TypeScript DOM lib)
interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionEvent extends Event {
  results: {
    length: number;
    [index: number]: {
      length: number;
      isFinal: boolean;
      [index: number]: SpeechRecognitionResult;
    };
  };
  resultIndex: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognition;

export function VoiceInput({ onTranscript, className = '', size = 'md' }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setSupported(true);
      const recognition = new (SpeechRecognitionAPI as SpeechRecognitionConstructor)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          onTranscript(final.trim());
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    }
    return () => {
      recognitionRef.current?.abort();
    };
  }, [onTranscript]);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  };

  if (!supported) return null;

  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className={`relative ${className}`}>
      <Button
        type="button"
        variant={listening ? 'destructive' : 'outline'}
        size="icon"
        className={`${sizeClass} ${listening ? 'animate-pulse' : ''}`}
        onClick={toggle}
        title={listening ? 'Stop recording' : 'Voice input'}
        aria-label={listening ? 'Stop recording' : 'Start voice input'}
      >
        {listening ? <Square className={iconSize} /> : <Mic className={iconSize} />}
      </Button>
      {listening && interimText && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 max-w-xs px-3 py-1.5 rounded-lg bg-muted border border-border text-xs whitespace-normal text-center">
          {interimText}
        </div>
      )}
      {listening && (
        <div className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="rounded-full h-3 w-3 bg-destructive" />
        </div>
      )}
    </div>
  );
}
