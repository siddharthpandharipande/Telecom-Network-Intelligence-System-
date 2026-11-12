import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  Mic,
  MicOff,
  X,
  RotateCcw,
  Bot,
  User,
  ShieldAlert,
  ChevronDown,
  Layers,
  HelpCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { askNocChatbot, clearNocChatbotSession } from '../../api/client';
import { ChatMessage } from '../../types/api';

const SUGGESTED_QUESTIONS = [
  'Why is this asset flagged for investigation?',
  'What is the primary operational issue?',
  'What are the recommended NOC actions?',
  'What is the difference between rule breaches and ML prediction?',
  'How does this asset compare to current network trends?',
  'What are the thresholds for latency and packet loss?',
  'Why are signal strength and call-drop rate not evaluated for this asset?',
  'What are the limitations of this analysis?',
  'Is this a confirmed hardware failure?',
  'Can you explain the Command Center insights for this asset?',
];

export const NocChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    return 'noc-session-' + Math.random().toString(36).substring(2, 9);
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Welcome to the NEXUSNET Tier-3 NOC Assistant. I am grounded in your latest manual telemetry analysis, rule breach thresholds, and network trend intelligence. How can I assist with your operational decision support today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: ['Grounded NOC Engine', 'V3 Policy'],
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [showChips, setShowChips] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputQuestion).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    setVoiceNotice(null);

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setIsLoading(true);

    // Retrieve latest analyzed record from localStorage to guarantee grounding across worker processes
    let telemetryContext: any = undefined;
    try {
      const stored = localStorage.getItem('nexusnet_latest_analysis');
      if (stored) {
        telemetryContext = JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    try {
      const response = await askNocChatbot({
        question: text,
        sessionId,
        telemetryContext,
      });

      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      const assistantMessage: ChatMessage = {
        id: 'assistant-' + Date.now(),
        sender: 'assistant',
        text: response.answer,
        timestamp: new Date(response.timestamp || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        sources: response.sources || ['Current Manual Telemetry Analysis'],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to reach NOC Chatbot service. Please verify backend connection.';
      setErrorMessage(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          sender: 'assistant',
          text: `Operational Advisory: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSession = async () => {
    if (isLoading) return;
    try {
      await clearNocChatbotSession(sessionId);
    } catch {
      // ignore clear error
    }
    const newSession = 'noc-session-' + Math.random().toString(36).substring(2, 9);
    setSessionId(newSession);
    setMessages([
      {
        id: 'reset-msg-' + Date.now(),
        sender: 'assistant',
        text: 'Session reset. Conversation history cleared. Ask me any question about the latest manual telemetry record, thresholds, or network trends.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: ['Grounded NOC Engine'],
      },
    ]);
    setErrorMessage(null);
    setVoiceNotice(null);
  };

  const handleChipClick = (question: string) => {
    setInputQuestion(question);
    handleSendMessage(question);
  };

  // Web Speech API Voice Input
  const toggleListening = () => {
    setVoiceNotice(null);
    setErrorMessage(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice('Voice recognition is not supported in this browser. Please type your question.');
      setTimeout(() => setVoiceNotice(null), 5000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice('Listening... Speak now. Your speech will be placed in the input box for review.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputQuestion(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceNotice('Microphone access denied. Please allow microphone permissions in your browser.');
        } else if (event.error !== 'no-speech') {
          setVoiceNotice(`Speech recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setVoiceNotice('Could not initiate microphone. Please try again or type your question.');
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-full shadow-2xl hover:shadow-indigo-500/25 border border-indigo-500/40 hover:border-indigo-400 transition-all duration-300 hover:scale-105 active:scale-95"
            aria-label="Open NOC Assistant"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
                NOC Assistant
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-indigo-500/30 text-indigo-300 rounded border border-indigo-400/30">
                  Tier-3 AI
                </span>
              </span>
              <span className="text-[10px] text-slate-400">Ask about telemetry & trends</span>
            </div>
          </button>
        )}
      </div>

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="NEXUSNET NOC Assistant"
          className="fixed bottom-6 right-6 w-[430px] sm:w-[480px] max-w-[calc(100vw-2rem)] h-[640px] max-h-[88vh] z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                <Bot className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-wide text-white">NEXUSNET NOC Assistant</h3>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
                    Tier-3 Ops
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Ask about telemetry, analysis, trends, and NOC actions</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearSession}
                disabled={isLoading}
                title="Reset conversation session"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Clear conversation session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Suggested Question Chips */}
          <div className="bg-slate-900/60 border-b border-slate-800/80 px-3 py-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Suggested NOC Queries
              </span>
              <button
                onClick={() => setShowChips(!showChips)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
              >
                {showChips ? 'Hide' : 'Show (10)'}
              </button>
            </div>

            {showChips && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChipClick(q)}
                    disabled={isLoading}
                    className="text-[11px] text-slate-300 bg-slate-800/80 hover:bg-indigo-900/40 hover:text-indigo-200 hover:border-indigo-500/50 border border-slate-700/60 rounded-full px-2.5 py-1 text-left transition-all duration-150 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Notification / Error Banner */}
          {voiceNotice && (
            <div className="px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-800/60 text-indigo-200 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                {voiceNotice}
              </span>
              <button onClick={() => setVoiceNotice(null)} className="text-indigo-400 hover:text-indigo-200">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="px-3 py-1.5 bg-rose-950/70 border-b border-rose-800/60 text-rose-200 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                {errorMessage}
              </span>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-end gap-2 max-w-[90%]">
                  {msg.sender === 'assistant' && (
                    <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400 mb-1 shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-sm shadow-md'
                        : msg.isError
                        ? 'bg-rose-950/60 border border-rose-800/80 text-rose-200 rounded-tl-sm'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-mono">Sources:</span>
                        {msg.sources.map((src, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 text-[9px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700/60"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400 mb-1 shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-slate-900/90 border border-slate-800 text-slate-300 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Gemini analyzing telemetry context...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-900/95 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder="Ask a question about this asset's telemetry or network status..."
                  maxLength={1000}
                  disabled={isLoading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-9 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Speak using microphone'}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                      : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={!inputQuestion.trim() || isLoading}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 active:scale-95 shrink-0"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

            {/* Disclaimer */}
            <p className="mt-2 text-[10px] text-slate-400 text-center leading-tight">
              AI-generated guidance. Verify critical NOC actions with official operational procedures.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

