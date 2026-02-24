import Link from "next/link";
import { MapIcon, BarChart3Icon, BikeIcon, RouteIcon, ActivityIcon } from "lucide-react";
import prisma from "@/lib/prisma";

async function getQuickStats() {
    const [totalTravels, totalBikes, totalStations] = await Promise.all([
        prisma.travel.count(),
        prisma.bike.count(),
        prisma.station.count(),
    ]);
    return { totalTravels, totalBikes, totalStations };
}

export default async function Home() {
    const { totalTravels, totalBikes, totalStations } = await getQuickStats();

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 flex flex-col">
            {/* Hero */}
            <header className="flex flex-col items-center justify-center pt-20 pb-12 px-4">
                <div className="flex items-center gap-3 mb-4">
                    <BikeIcon className="h-10 w-10 text-red-500" />
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                        Vélo&apos;v <span className="text-red-500">Tracking</span>
                    </h1>
                </div>
                <p className="text-lg text-zinc-500 dark:text-zinc-400 text-center max-w-xl">
                    Explorez les statistiques et les données en temps réel du réseau Vélo&apos;v de Lyon.
                    Visualisez les trajets, les stations et bien plus encore.
                </p>
            </header>

            {/* Quick stats */}
            <section className="flex justify-center gap-6 sm:gap-10 px-4 pb-12">
                <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold">{totalTravels.toLocaleString("fr-FR")}</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <RouteIcon className="h-3.5 w-3.5" /> Trajets enregistrés
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold">{totalBikes.toLocaleString("fr-FR")}</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <BikeIcon className="h-3.5 w-3.5" /> Vélos suivis
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold">{totalStations.toLocaleString("fr-FR")}</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <ActivityIcon className="h-3.5 w-3.5" /> Stations
                    </span>
                </div>
            </section>

            {/* Navigation cards */}
            <section className="flex-1 flex items-start justify-center px-4 pb-20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
                    <Link
                        href="/map"
                        className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-5">
                                <MapIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Carte interactive</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Visualisez les stations, les trajets et la heatmap d&apos;activité sur une carte interactive de Lyon.
                            </p>
                        </div>
                        <div className="absolute bottom-4 right-4 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </div>
                    </Link>

                    <Link
                        href="/statistics"
                        className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 mb-5">
                                <BarChart3Icon className="h-7 w-7 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Statistiques</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Découvrez les statistiques détaillées : trajet le plus long, vélo le plus utilisé, durée moyenne et plus.
                            </p>
                        </div>
                        <div className="absolute bottom-4 right-4 text-zinc-300 dark:text-zinc-600 group-hover:text-red-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </div>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-zinc-400 dark:text-zinc-600">
                Vélo&apos;v Tracking — Données du réseau Vélo&apos;v de Lyon
            </footer>
        </div>
    );
}
