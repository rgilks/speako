import { Fragment } from "preact";
import { TranscriptionResult } from "../../logic/transcriber";

interface TranscriptBoxProps {
    transcript: TranscriptionResult | null;
}

export function TranscriptBox({ transcript }: TranscriptBoxProps) {
    return (
        <div className="transcript-box">
            <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <p className="metric-label">Transcript</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
                    <span className="metric-sublabel" style={{ fontSize: '0.65rem' }}>Unclear</span>
                </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: '300px', overflowY: 'auto' }}>
                {transcript?.words && transcript.words.length > 0 ? (
                    transcript.words.map((w, i) => (
                        <Fragment key={i}>
                            <span title={`Confidence: ${Math.round(w.score * 100)}%`} 
                                style={{ 
                                    color: w.score < 0.7 ? '#ef4444' : w.score < 0.85 ? '#fbbf24' : 'inherit',
                                    borderBottom: w.score < 0.7 ? '1px dashed rgba(239, 68, 68, 0.4)' : 'none',
                                    paddingBottom: w.score < 0.7 ? '2px' : '0',
                                    cursor: 'help',
                                    transition: 'color 0.2s'
                                }}>
                                {w.word}
                            </span>
                            {" "}
                        </Fragment>
                    ))
                ) : (
                    transcript?.text || ""
                )}
            </p>
        </div>
    );
}
