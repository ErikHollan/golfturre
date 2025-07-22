import { useState } from "react";
import RoundInfo from "./RoundInfo"; // make sure this path is correct

export default function TournamentStandings({ prevStandings, players, rounds, tournamentModes, tournament, setTournament }) {
    const [activeRoundIndex, setActiveRoundIndex] = useState(0);

    const getTotalWithDeduction = (player) => {
        const rawTotal = player.scores.reduce((sum, val) => sum + (val || 0), 0);
        let deduction = 0;

        if (tournament.miniGames?.length > 0) {
            tournament.miniGames.forEach((miniGame) => {
                if (miniGame.subtract_from_score) {
                    tournament.rounds.forEach((_, roundIdx) => {
                        const val = player?.miniGameScores?.[roundIdx]?.[miniGame.name];
                        if (val) {
                            deduction += val * (miniGame.deduction_value || 0);
                        }
                    });
                }
            });
        }

        return rawTotal - deduction;
    };


    const sortedPlayers = [...tournament.playerData].sort(
        (a, b) => getTotalWithDeduction(a) - getTotalWithDeduction(b)
    );

    const finalRoundIndex = rounds.length - 1;
    const finalRoundHasScores = players.some(
        (p) => typeof p.scores?.[finalRoundIndex] === "number" && p.scores[finalRoundIndex] > 0
    );

    const podium = sortedPlayers.slice(0, 3);
    const activeRound = tournament.rounds[activeRoundIndex];

    const teamStandings = ["red", "green"]
        .map((teamKey) => {
            const teamPlayers = tournament.playerData.filter(
                (p) => tournament.team_data.assignments[p.id] === teamKey
            );

            const total = teamPlayers.reduce(
                (sum, p) => sum + getTotalWithDeduction(p),
                0
            );

            return {
                key: teamKey,
                name:
                    tournament.team_data?.captains?.[teamKey] ||
                    (teamKey === "red" ? "Röd" : "Grön"),
                color:
                    tournament.team_data?.colors?.[teamKey] ||
                    (teamKey === "red" ? "#DC2626" : "#059669"),
                total,
            };
        })
        .sort((a, b) => a.total - b.total); // sortera stigande


    return (
        <div className="mt-6 space-y-10">

            {/* 🟥🟩 Team Standings */}
            {tournament.team_mode && tournament.team_data?.assignments && (
                <div className="bg-blue-800/50 p-4 rounded-xl shadow">
                    <h2 className="text-xl font-bold mb-4">👥 Lagresultat</h2>
                    <table className="min-w-full text-sm text-left text-white">
                        <thead className="uppercase text-xs text-gray-300 border-b border-gray-600">
                            <tr>
                                <th className="py-2 px-4">Team</th>
                                <th className="py-2 px-4">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teamStandings.map((team) => (
                                <tr key={team.key} className="border-b border-blue-700 last:border-none">
                                    <td className="py-2 px-4 font-medium flex items-center gap-2">
                                        <span
                                            className="inline-block w-3 h-3 rounded-full"
                                            style={{ backgroundColor: team.color }}
                                        ></span>
                                        Team {team.name}
                                    </td>
                                    <td className="py-2 px-4 text-yellow-300 font-bold">{team.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 🏆 Main Table */}
            <div className="bg-blue-800/50 p-4 rounded-xl shadow">
                <h2 className="text-xl font-bold mb-4">🏆 Turneringsresultat</h2>
                {finalRoundHasScores &&
                    <div className="mb-10 mt-10 sm:mt-8">
                        <div className="flex justify-center items-end gap-4 sm:gap-6 mt-4 text-center">
                            {/* 🥈 Silver */}
                            <div className="flex flex-col items-center justify-end relative w-20 sm:w-28 text-xs sm:text-sm">
                                <div className="absolute -top-6 sm:-top-8 text-2xl sm:text-4xl">🥈</div>
                                <div className="bg-gradient-to-t from-slate-700 to-slate-500 text-white px-2 py-1 sm:px-3 sm:py-2 rounded-t-xl shadow w-full font-semibold truncate">
                                    {podium[1]?.name}
                                </div>
                                <div className="bg-slate-600 w-full h-16 sm:h-24 rounded-b-xl flex items-center justify-center text-yellow-200 font-bold border-t border-white/20">
                                    {getTotalWithDeduction(podium[1])} slag
                                </div>
                            </div>

                            {/* 🥇 Gold */}
                            <div className="flex flex-col items-center justify-end relative w-24 sm:w-32 scale-105 sm:scale-110 z-10 text-xs sm:text-sm">
                                <div className="absolute -top-7 sm:-top-10 text-3xl sm:text-5xl drop-shadow-md">👑</div>
                                <div className="bg-gradient-to-t from-yellow-500 to-yellow-300 text-black px-2 py-1 sm:px-3 sm:py-2 rounded-t-xl shadow w-full font-extrabold tracking-wide truncate">
                                    {podium[0]?.name}
                                </div>
                                <div className="bg-yellow-400 w-full h-20 sm:h-32 rounded-b-xl flex items-center justify-center text-black font-black border-t border-black/20 text-sm sm:text-lg">
                                    {getTotalWithDeduction(podium[0])} slag
                                </div>
                            </div>

                            {/* 🥉 Bronze */}
                            <div className="flex flex-col items-center justify-end relative w-20 sm:w-28 text-xs sm:text-sm">
                                <div className="absolute -top-6 sm:-top-8 text-2xl sm:text-4xl">🥉</div>
                                <div className="bg-gradient-to-t from-amber-800 to-amber-600 text-white px-2 py-1 sm:px-3 sm:py-2 rounded-t-xl shadow w-full font-semibold truncate">
                                    {podium[2]?.name}
                                </div>
                                <div className="bg-amber-700 w-full h-14 sm:h-20 rounded-b-xl flex items-center justify-center text-yellow-100 font-bold border-t border-white/20">
                                    {getTotalWithDeduction(podium[2])} slag
                                </div>
                            </div>
                        </div>
                    </div>

                }
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-white">
                        <thead className="uppercase text-xs text-gray-300 border-b border-gray-600">
                            <tr>
                                <th className="py-2 px-4">#</th>
                                <th className="py-2 px-4">Spelare</th>
                                {rounds.map((round, idx) => (
                                    <th key={idx} className="py-2 px-4">
                                        {/* Visa bara round number på mobil, full text på sm+ */}
                                        <span className="block sm:hidden">{idx + 1}</span>
                                        <span className="hidden sm:block">{round}</span>
                                    </th>
                                ))}
                                {tournament.miniGames?.some((m) => m.subtract_from_score) && (
                                    <th className="py-2 px-4 text-center min-w-[50px]">⭐</th>
                                )}
                                <th className="py-2 px-4 text-yellow-300">Total</th>
                            </tr>
                            <tr className="text-[10px] font-normal text-gray-400 leading-tight -mt-1">
                                <td className="pt-0 pb-1 px-4"></td>
                                <td className="pt-0 pb-1 px-4"></td>

                                {tournamentModes.map((mode, idx) => (
                                    <td key={idx} className="pt-0 pb-1 px-4 italic">
                                        {/* Dölj mode-text på mobil */}
                                        <span className="hidden sm:inline">{mode}</span>
                                    </td>
                                ))}

                                <td className="pt-0 pb-1 px-4"></td>
                            </tr>
                        </thead>

                        <tbody>
                            {sortedPlayers.map((player, index) => {
                                const rawTotal = player.scores.reduce((a, b) => a + (b || 0), 0);

                                // Räkna ut avdrag
                                let deduction = 0;
                                if (tournament.miniGames?.length > 0) {
                                    tournament.miniGames.forEach((miniGame) => {
                                        if (miniGame.subtract_from_score) {
                                            tournament.rounds.forEach((_, roundIdx) => {
                                                const val = player?.miniGameScores?.[roundIdx]?.[miniGame.name];
                                                if (val) {
                                                    deduction += val * (miniGame.deduction_value || 0);
                                                }
                                            });
                                        }
                                    });
                                }

                                const total = rawTotal - deduction;
                                const prevPos = prevStandings.indexOf(player.id);
                                const currentPos = index;
                                const posDifference = prevPos - currentPos;


                                return (
                                    <tr
                                        key={player.id}
                                        className={index % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}
                                    >
                                        <td className="py-2 px-4">{index + 1}</td>
                                        <td className="py-2 px-4 font-medium flex items-center gap-2">
                                            {tournament.team_mode && tournament.team_data?.assignments?.[player.id] && (
                                                <span
                                                    className="inline-block w-2.5 h-2.5 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            tournament.team_data.assignments[player.id] === "red"
                                                                ? "#DC2626"
                                                                : "#059669"
                                                    }}
                                                />
                                            )}
                                            <span className="flex items-center gap-1">
                                                {player.name}
                                            </span>
                                            {player.scores[1] !== null && player.scores[1] !== 0 && (
                                                prevStandings.length > 0 && prevPos !== -1 ? (
                                                    currentPos < prevPos ? (
                                                        <span className="text-green-400">+{posDifference}</span>
                                                    ) : currentPos > prevPos ? (
                                                        <span className="text-red-400">{posDifference}</span>
                                                    ) : null
                                                ) : null
                                            )}
                                        </td>
                                        {player.scores.map((score, idx) => (
                                            <td key={idx} className="py-2 px-4">{score}</td>
                                        ))}
                                        {tournament.miniGames?.some((m) => m.subtract_from_score) && (
                                            <td className="py-2 px-4 text-green-300 font-bold whitespace-nowrap min-w-[60px] text-center">–{deduction}</td>

                                        )}
                                        <td className="py-2 px-4 font-bold text-yellow-300">{total}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* 🕓 Round Info Carousel - extracted to own component */}
            <RoundInfo
                activeRoundIndex={activeRoundIndex}
                setActiveRoundIndex={setActiveRoundIndex}
                rounds={tournament.rounds}
                players={players}
                activeRound={activeRound}
                tournament={tournament}
                setTournament={setTournament}
            />
        </div>
    );
}
