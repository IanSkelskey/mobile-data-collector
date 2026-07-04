import { motion } from 'framer-motion';
import toeCodeModel from '../utils/toeCodeModel';

const formatBoolean = (value) => {
    if (value === true || value === 'true') return 'Yes';
    if (value === false || value === 'false') return 'No';
    return value || 'N/A';
};

const formatDate = (value) => {
    if (!value || value === 'N/A') return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
};

const formatValue = (value, suffix = '') => {
    if (value === undefined || value === null || value === '') return 'N/A';
    if (value === 'true' || value === 'false' || typeof value === 'boolean') {
        return formatBoolean(value);
    }
    if (value === 'N/A') return value;
    return `${value}${suffix}`;
};

const metricFields = [
    { label: 'SVL', key: 'svlMm', suffix: ' mm' },
    { label: 'VTL', key: 'vtlMm', suffix: ' mm' },
    { label: 'OTL', key: 'otlMm', suffix: ' mm' },
    { label: 'Mass', key: 'massG', suffix: ' g' },
];

const flagFields = [
    { label: 'Sex', key: 'sex' },
    { label: 'Recap', key: 'recapture' },
    { label: 'Regen', key: 'regenTail' },
    { label: 'Hatch', key: 'hatchling' },
    { label: 'Dead', key: 'dead' },
];

export default function RecaptureHistoryModal({
    currentData,
    speciesCode,
    toeCode,
    previousLizardEntries,
    onClose,
}) {
    return (
        <motion.div
            className="recapture-history-modal fixed inset-0 z-50 flex flex-col bg-white text-black"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, y: '100%', transition: { duration: 0.16 } }}
        >
            <header className="relative flex min-h-14 flex-none items-center justify-center border-b-2 border-asu-maroon bg-white px-12 text-center">
                <div className="min-w-0 py-2">
                    <h1 className="truncate text-xl font-semibold leading-tight">
                        Recapture History
                    </h1>
                    <p className="truncate text-xs leading-tight text-black/60">
                        {previousLizardEntries.length} matching{' '}
                        {previousLizardEntries.length === 1 ? 'entry' : 'entries'}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Close recapture history"
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-asu-maroon bg-white text-xl font-semibold leading-none text-asu-maroon transition active:scale-90"
                    onClick={onClose}
                >
                    X
                </button>
            </header>

            <div className="grid flex-none grid-cols-3 border-b border-black/10 bg-black/[0.03] text-center">
                <SummaryItem label="Site" value={currentData.site} />
                <SummaryItem label="Species" value={speciesCode || 'N/A'} />
                <SummaryItem
                    label="Toe Code"
                    value={toeCodeModel.formatForDisplay(toeCode, 'N/A')}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-asu-maroon">
                {previousLizardEntries.length ? (
                    previousLizardEntries.map((entry, index) => (
                        <HistoryEntry
                            key={entry.entryId ?? `${entry.dateTime}-${index}`}
                            entry={entry}
                            index={index}
                        />
                    ))
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <p className="text-lg font-semibold text-black">No history found</p>
                        <p className="mt-1 text-sm text-black/60">
                            This toe-clip code has no cached records for the selected site and
                            species.
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function SummaryItem({ label, value }) {
    return (
        <div className="min-w-0 border-r border-black/10 px-1 py-1 last:border-r-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase leading-tight text-black/50">
                {label}
            </p>
            <p className="truncate text-sm font-semibold leading-tight">{value || 'N/A'}</p>
        </div>
    );
}

function HistoryEntry({ entry, index }) {
    const comments = entry.comments && entry.comments !== 'N/A' ? entry.comments : '';
    const recaptureStatus = formatBoolean(entry.recapture);
    const isRecaptureEntry = recaptureStatus === 'Yes';

    return (
        <article className="border-b border-black/15 bg-white">
            <div className="flex min-h-11 items-center justify-between gap-2 border-b border-black/10 bg-black/[0.02] px-2">
                <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight">
                        {formatDate(entry.dateTime)}
                    </p>
                    <p className="truncate text-xs leading-tight text-black/60">
                        Entry {index + 1} - Array {formatValue(entry.array)}
                    </p>
                </div>
                <span
                    className={`shrink-0 px-2 py-1 text-xs font-semibold leading-tight ${
                        isRecaptureEntry
                            ? 'bg-asu-maroon text-asu-gold'
                            : 'bg-black/10 text-black/70'
                    }`}
                >
                    {isRecaptureEntry ? 'Recapture' : recaptureStatus === 'No' ? 'New' : 'N/A'}
                </span>
            </div>

            <div className="grid grid-cols-4 border-b border-black/10 text-center">
                {metricFields.map(({ label, key, suffix }) => (
                    <DataCell key={key} label={label} value={formatValue(entry[key], suffix)} />
                ))}
            </div>

            <div className="grid grid-cols-5 border-b border-black/10 text-center">
                {flagFields.map(({ label, key }) => (
                    <DataCell key={key} label={label} value={formatValue(entry[key])} compact />
                ))}
            </div>

            <CommentsRow comments={comments} />
        </article>
    );
}

function CommentsRow({ comments }) {
    if (!comments) {
        return (
            <div className="flex min-h-8 items-center justify-between px-2 text-left">
                <span className="text-[0.65rem] font-semibold uppercase leading-tight text-black/50">
                    Comments
                </span>
                <span className="text-xs font-semibold leading-tight text-black/50">None</span>
            </div>
        );
    }

    return (
        <details className="group text-left">
            <summary className="flex min-h-8 cursor-pointer items-center justify-between px-2">
                <span className="text-[0.65rem] font-semibold uppercase leading-tight text-black/50">
                    Comments
                </span>
                <span className="rounded bg-black/10 px-2 py-1 text-xs font-semibold leading-tight text-black/70 group-open:hidden">
                    View
                </span>
                <span className="hidden rounded bg-asu-maroon px-2 py-1 text-xs font-semibold leading-tight text-asu-gold group-open:block">
                    Hide
                </span>
            </summary>
            <p className="break-words border-t border-black/10 px-2 py-2 text-sm leading-snug text-black">
                {comments}
            </p>
        </details>
    );
}

function DataCell({ label, value, compact }) {
    return (
        <div className="min-w-0 border-r border-black/10 px-1 py-1 last:border-r-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase leading-tight text-black/50">
                {label}
            </p>
            <p
                className={`truncate font-semibold leading-tight text-black ${
                    compact ? 'text-xs' : 'text-sm'
                }`}
            >
                {value}
            </p>
        </div>
    );
}
