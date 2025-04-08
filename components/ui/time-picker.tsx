"use client";

import { TimePickerInput } from "./time-picker-input";
import { useRef } from "react";

interface TimePickerProps {
    date: Date | undefined;
    setDate?: (date: Date | undefined) => void;
}

export function TimePicker({ date, setDate }: TimePickerProps) {
    const minuteRef = useRef<HTMLInputElement>(null);
    const hourRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex gap-1 items-center">
            <div className="grid gap-1 text-center">
                <TimePickerInput
                    picker="hours"
                    date={date}
                    setDate={setDate}
                    ref={hourRef}
                    onRightFocus={() => minuteRef.current?.focus()}
                />
            </div>
            <span>:</span>
            <div className="grid gap-1 text-center">
                <TimePickerInput
                    picker="minutes"
                    date={date}
                    setDate={setDate}
                    ref={minuteRef}
                    onLeftFocus={() => hourRef.current?.focus()}
                />
            </div>
        </div>
    );
}