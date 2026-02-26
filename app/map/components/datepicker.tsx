"use client"

import { format, addDays } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { DateRange, Matcher } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { fr } from "date-fns/locale";

interface Props {
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
    maxDays?: number
    className?: string
}

export function DatePickerWithRange({
    date,
    setDate,
    maxDays,
    className
}: Props) {

    // When from is selected but to is not yet, disable dates outside the allowed range
    const disabledDays: Matcher[] = [];
    if (maxDays && date?.from && !date?.to) {
        disabledDays.push(
            { after: addDays(date.from, maxDays - 1) },
            { before: addDays(date.from, -(maxDays - 1)) }
        );
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "PPP", { locale: fr })} -{" "}
                                    {format(date.to, "PPP", { locale: fr })}
                                </>
                            ) : (
                                format(date.from, "PPP", { locale: fr })
                            )
                        ) : (
                            <span>Choisir une date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        disabled={disabledDays}
                    />
                    {maxDays && (
                        <p className="text-xs text-zinc-500 text-center pb-2">
                            {maxDays} jours maximum
                        </p>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}
