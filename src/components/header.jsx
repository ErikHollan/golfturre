import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { HomeIcon, UserIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [tournamentTitle, setTournamentTitle] = useState("");
    const menuRef = useRef(null);

    const isStartPage = location.pathname === "/";
    const tournamentMatch = matchPath("/turnering/:id", location.pathname);
    const tournamentId = tournamentMatch?.params?.id;

    // 🔄 Fetch username
    useEffect(() => {
        const fetchUsername = async () => {
            if (!user) return;
            const { data, error } = await supabase
                .from("users")
                .select("username")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error("Kunde inte hämta användarnamn:", error);
            } else {
                setUsername(data.username);
            }
        };

        fetchUsername();
    }, [user]);

    // 🔄 Fetch tournament name
    useEffect(() => {
        const fetchTournamentTitle = async () => {
            if (!tournamentId) {
                setTournamentTitle("");
                return;
            }

            const { data, error } = await supabase
                .from("tournaments")
                .select("name")
                .eq("id", tournamentId)
                .single();

            if (error) {
                console.error("Kunde inte hämta turneringens namn:", error);
                setTournamentTitle("Turnering");
            } else {
                setTournamentTitle(data.name);
            }
        };

        fetchTournamentTitle();
    }, [tournamentId]);

    // ⛔ Close dropdown menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header
            className="w-full px-4 sm:px-8 py-4 flex items-center justify-between bg-white border-b border-gray-200 shadow-sm"
            style={{ minHeight: "64px" }}
        >
            {/* Left: Home */}
            <div className="w-28 flex items-center">
                {!isStartPage && (
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition"
                    >
                        <HomeIcon className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm tracking-tight">Start</span>
                    </button>
                )}
            </div>

            {/* Center: Title */}
            <div className="flex flex-col items-center text-center leading-tight">
                <h1 className="text-base sm:text-2xl font-bold text-gray-800 tracking-tight">
                    {tournamentTitle || "HoleInOne.se"}
                </h1>

            </div>

            {/* Right: User Info */}
            <div className="w-28 flex justify-end items-center relative">
                {user ? (
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition"
                        >
                            <UserIcon className="w-4 h-4 text-green-500" />
                            <span className="truncate max-w-[90px] text-sm">{username || "..."}</span>
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-30">
                                <div className="px-4 py-2 text-sm text-gray-600 font-medium">
                                    {username || "Profil"}
                                </div>
                                <hr className="my-1 border-gray-100" />
                                <button
                                    onClick={async () => {
                                        await supabase.auth.signOut();
                                        setMenuOpen(false);
                                        navigate("/login");
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition"
                                >
                                    Logga ut
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => navigate("/login")}
                        className="text-green-600 hover:text-green-700 font-medium text-sm transition"
                    >
                        Logga in
                    </button>
                )}
            </div>
        </header>


    );
}
