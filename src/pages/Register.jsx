import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const navigate = useNavigate();

    const handleRegister = async () => {
        const { data: authData, error: signupError } = await supabase.auth.signUp({ email, password });

        if (signupError) {
            alert("Registrering misslyckades: " + signupError.message);
            return;
        }

        if (!authData.user?.identities?.length) {
            alert("Den här e-postadressen används redan.");
            return;
        }

        const { error: insertError } = await supabase.from("users").insert([
            {
                user_id: authData.user.id,
                username,
            },
        ]);

        if (insertError) {
            console.error("Insert failed:", insertError);
            alert("Kunde inte spara användarnamn.");
        } else {
            alert("Registrering lyckades! Bekräfta din e-post innan du loggar in.");
            navigate("/login");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
            <motion.div
                className="w-full max-w-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="rounded-[2rem] shadow-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10">
                    <CardContent className="pt-10 px-8 sm:px-10 pb-12 flex flex-col gap-6 items-center text-center">

                        <div className="text-center mb-2 space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-extrabold text-yellow-400 drop-shadow-sm">
                                HoleInOne.se
                            </h1>
                            <p className="text-white/70 text-xs sm:text-sm max-w-xs mx-auto">
                                Skapa ett konto för att komma igång.
                            </p>
                        </div>

                        <h2 className="text-xl sm:text-3xl font-extrabold tracking-wide text-white mt-1">
                            Skapa konto
                        </h2>

                        <input
                            type="text"
                            placeholder="Användarnamn"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        />

                        <input
                            type="email"
                            placeholder="E-post"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        />

                        <input
                            type="password"
                            placeholder="Lösenord"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        />

                        <Button
                            onClick={handleRegister}
                            className="w-full text-base sm:text-lg py-3 sm:py-4 rounded-lg bg-green-500 hover:bg-green-400 font-semibold tracking-wide shadow-md hover:shadow-green-500/40 transition-all duration-200"
                        >
                            Skapa konto
                        </Button>

                        <p className="text-xs sm:text-sm text-white/60 mt-1">
                            Har du redan ett konto?{" "}
                            <Link to="/login" className="text-green-400 font-medium hover:underline">
                                Logga in här
                            </Link>
                        </p>

                        <p className="text-[10px] sm:text-xs text-white/30 mt-6 tracking-wide">
                            © {new Date().getFullYear()} HoleInOne.se – En tjänst från Hollander web
                        </p>

                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
