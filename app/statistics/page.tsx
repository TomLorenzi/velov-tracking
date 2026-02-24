import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import {
    HomeIcon,
    RouteIcon,
    BikeIcon,
    ClockIcon,
    MapPinIcon,
    TrendingUpIcon,
    CalendarIcon,
    RefreshCwIcon,
} from "lucide-react";

const getStatistics = unstable_cache(
    async () => {
        const stats = await prisma.statistic.findMany();
        const map: Record<string, { value: string; label: string; updatedAt: Date }> = {};
        for (const stat of stats) {
            map[stat.key] = { value: stat.value, label: stat.label, updatedAt: stat.updatedAt };
        }
        return map;
    },
    ["statistics"],
    { revalidate: 60 * 5, tags: ["statistics"] }
);

const STAT_ICONS: Record<string, React.ReactNode> = {
    total_travels: <RouteIcon className="h-6 w-6" />,
    total_bikes: <BikeIcon className="h-6 w-6" />,
    total_stations: <MapPinIcon className="h-6 w-6" />,
    longest_travel_duration: <TrendingUpIcon className="h-6 w-6" />,
    longest_travel_info: <RouteIcon className="h-6 w-6" />,
    most_used_bike: <BikeIcon className="h-6 w-6" />,
    most_used_bike_travels: <TrendingUpIcon className="h-6 w-6" />,
    average_travel_duration: <ClockIcon className="h-6 w-6" />,
    busiest_departure_station: <MapPinIcon className="h-6 w-6" />,
    busiest_departure_count: <TrendingUpIcon className="h-6 w-6" />,
    busiest_arrival_station: <MapPinIcon className="h-6 w-6" />,
    busiest_arrival_count: <TrendingUpIcon className="h-6 w-6" />,
    busiest_hour: <ClockIcon className="h-6 w-6" />,
    travels_today: <CalendarIcon className="h-6 w-6" />,
    most_common_route: <RouteIcon className="h-6 w-6" />,
    most_common_route_count: <TrendingUpIcon className="h-6 w-6" />,
};

const STAT_COLORS: Record<string, string> = {
    total_travels: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    total_bikes: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    total_stations: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    longest_travel_duration: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    longest_travel_info: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    most_used_bike: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    most_used_bike_travels: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    average_travel_duration: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    busiest_departure_station: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    busiest_departure_count: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    busiest_arrival_station: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
    busiest_arrival_count: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
    busiest_hour: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    travels_today: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    most_common_route: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
    most_common_route_count: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
};

const DISPLAY_ORDER = [
    "total_travels",
    "total_bikes",
    "total_stations",
    "average_travel_duration",
    "longest_travel_duration",
    "longest_travel_info",
    "most_used_bike",
    "most_used_bike_travels",
    "busiest_departure_station",
    "busiest_departure_count",
    "busiest_arrival_station",
    "busiest_arrival_count",
    "busiest_hour",
    "travels_today",
    "most_common_route",
    "most_common_route_count",
];

export default async function StatisticsPage() {
    const stats = await getStatistics();

    const lastUpdated = Object.values(stats)[0]?.updatedAt;

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <HomeIcon className="h-4 w-4" />
                    Accueil
                </Link>
                <h1 className="text-lg font-semibold">Statistiques Vélo&apos;v</h1>
                <div className="w-20" />
            </header>

            <main className="max-w-5xl mx-auto px-4 py-10">
                {/* Last updated */}
                {lastUpdated && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 mb-8">
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Dernière mise à jour : {new Date(lastUpdated).toLocaleString("fr-FR", {
                            dateStyle: "long",
                            timeStyle: "short",
                        })}
                    </div>
                )}

                {Object.keys(stats).length === 0 ? (
                    <div className="text-center py-20">
                        <ClockIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Statistiques en cours de calcul</h2>
                        <p className="text-zinc-500 dark:text-zinc-400">
                            Les statistiques sont recalculées toutes les heures. Revenez bientôt !
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {DISPLAY_ORDER.filter((key) => stats[key]).map((key) => {
                            const stat = stats[key];
                            const defaultColor = "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
                            return (
                                <div
                                    key={key}
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${STAT_COLORS[key] || defaultColor}`}>
                                            {STAT_ICONS[key] || <TrendingUpIcon className="h-6 w-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                                                {stat.label}
                                            </p>
                                            <p className="text-xl font-bold truncate" title={stat.value}>
                                                {stat.value}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
