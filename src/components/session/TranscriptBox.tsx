import { Fragment } from "preact";
import { TranscriptionResult } from "../../logic/transcriber";

interface TranscriptBoxProps {
    transcript: TranscriptionResult | null;
}

export function TranscriptBox({ transcript }: TranscriptBoxProps) {
    return (
        <div className="transcript-box">
            <p className="metric-label" style={{ marginBottom: '1rem' }}>Transcript</p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, maxHeight: '300px', overflowY: 'auto' }}>
                {transcript?.text || ""}
            </p>
        </div>
    );
}
