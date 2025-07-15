import React from "react";

export default function MiniGamesStandings({ tournament }) {    
    const miniGames = tournament.miniGames || [];
    const players = tournament.playerData || [];

    console.log("tournament", tournament)

    const playerScores = players.map((player) => {
        let total = 0;
        const breakdown = {};

        miniGames.forEach((mini) => {
            let score = 0;
            for (const roundIdx in player.miniGameScores || {}) {
                score += player.miniGameScores[roundIdx]?.[mini.name] || 0;
            }
            breakdown[mini.name] = score;
            total += score;
        });

        return {
            id: player.id,
            name: player.name,
            total,
            breakdown,
        };
    });

    const sorted = [...playerScores].sort((a, b) => b.total - a.total);
    let currentRank = 1;
    let prevScore = null;
    let skip = 0;

    sorted.forEach((p, i) => {
        if (p.total !== prevScore) {
            currentRank += skip;
            p.rank = currentRank;
            skip = 1;
        } else {
            p.rank = currentRank;
            skip += 1;
        }
        prevScore = p.total;
    });

    const podium = sorted.filter(p => p.rank <= 3);
    const rest = sorted.filter(p => p.rank > 3);

    const getMedal = (rank) => {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return "";
    };

    const getPodiumColor = (rank) => {
        if (rank === 1) return "bg-yellow-400";
        if (rank === 2) return "bg-gray-300";
        if (rank === 3) return "bg-amber-500";
        return "bg-blue-200";
    };

    return (
        <div className="space-y-10 mt-6">
            {/* 🏆 Podium */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 rounded-lg text-white text-center">
                <h2 className="text-2xl font-bold mb-6">🎯 Mini Game Podium</h2>
                <div className="flex justify-center gap-4 items-end">
                    {podium.map((player) => (
                        <div
                            key={player.id}
                            className={`rounded-lg pt-4 px-4 pb-2 w-32 flex flex-col items-center shadow-lg ${getPodiumColor(player.rank)}`}
                        >
                            <div className="mb-2 space-y-1">
                                {miniGames.length === 1 ? (
                                    // Only one mini game — show just the stars once
                                    <div className="text-yellow-700 font-bold text-base">
                                        {"⭐".repeat(player.total) || "–"}
                                    </div>
                                ) : (
                                    <>
                                        {miniGames.map((mini) => (
                                            <div key={mini.name} className="text-sm">
                                                <span className="block text-xs text-black/70 font-medium">{mini.name}</span>
                                                <span className="text-yellow-600 text-base">
                                                    {"⭐".repeat(player.breakdown[mini.name]) || "–"}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="text-yellow-700 font-bold text-base border-t border-black/10 mt-1 pt-1">
                                            {"⭐".repeat(player.total)}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="bg-white text-sm text-black px-2 py-1 rounded w-full text-center mt-2">
                                {getMedal(player.rank)} {player.name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 📋 Others */}
            <div className="bg-blue-900/60 p-4 rounded-xl shadow text-white">
                <h3 className="text-lg font-bold mb-4">📋 Övriga Spelare</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="uppercase text-xs text-gray-300 border-b border-gray-600">
                            <tr>
                                <th className="py-2 px-4">Pos</th>
                                <th className="py-2 px-4">Spelare</th>
                                {miniGames.map((mini, i) => (
                                    <th key={i} className="py-2 px-4 text-center">{mini.name}</th>
                                ))}
                                <th className="py-2 px-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rest.map((player, idx) => (
                                <tr
                                    key={player.id}
                                    className={idx % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}
                                >
                                    <td className="py-2 px-4">{player.rank}</td>
                                    <td className="py-2 px-4">{player.name}</td>
                                    {miniGames.map((mini, i) => (
                                        <td key={i} className="py-2 px-4 text-center text-yellow-300">
                                            {player.breakdown[mini.name] > 0
                                                ? "⭐".repeat(player.breakdown[mini.name])
                                                : "–"}
                                        </td>
                                    ))}
                                    <td className="py-2 px-4 text-right text-yellow-300">
                                        {player.total > 0 ? "⭐".repeat(player.total) : "–"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
