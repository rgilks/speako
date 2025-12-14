import { Fragment } from "preact";
import { TranscriptionResult } from "../../logic/transcriber";

interface TranscriptBoxProps {
    transcript: TranscriptionResult | null;
}

function getWordStyle(score: number) {
    if (score >= 0.98) {
        // Clear - subtle green (98%+)
        return { 
            color: '#4ade80',
            background: 'rgba(34, 197, 94, 0.1)',
            padding: '1px 3px',
            borderRadius: '3px',
        };
    } else if (score >= 0.90) {
        // Good - amber (90-98%)
        return { 
            color: '#fbbf24',
            background: 'rgba(245, 158, 11, 0.15)',
            padding: '1px 3px',
            borderRadius: '3px',
        };
    } else {
        // Needs review - red (<90%)
        return { 
            color: '#f87171',
            background: 'rgba(239, 68, 68, 0.2)',
            padding: '1px 3px',
            borderRadius: '3px',
            borderBottom: '2px solid rgba(239, 68, 68, 0.6)',
        };
    }
}

export function TranscriptBox({ transcript }: TranscriptBoxProps) {
    return (
        <div className="transcript-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p className="metric-label">Transcript</p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }}></span>
                        Clear
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }}></span>
                        Good
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }}></span>
                        Review
                    </span>
                </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, maxHeight: '300px', overflowY: 'auto' }}>
                {transcript?.words && transcript.words.length > 0 ? (
                    transcript.words.map((w, i) => (
                        <Fragment key={i}>
                            <span 
                                title={`"${w.word}" - ${Math.round(w.score * 100)}% confidence`} 
                                style={{ 
                                    ...getWordStyle(w.score),
                                    cursor: 'help',
                                    transition: 'all 0.2s'
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
