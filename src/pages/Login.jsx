import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!loading && user) {
            navigate("/");
        }
    }, [user, loading, navigate]);

    const handleLogin = async () => {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

        if (loginError) {
            console.log("LOGINERROR", loginError);
            if (loginError.message?.includes("Email not confirmed")) {
                setErrorMessage("Du måste bekräfta din e-postadress innan du kan logga in.");
            } else {
                setErrorMessage("Fel i inloggning. Kontrollera e-post och lösenord.");
            }
            return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            setErrorMessage("Hittade ingen använvdare.");
            console.error(userError);
            return;
        }

        if (!user.email_confirmed_at) {
            setErrorMessage("Du måste bekräfta din e-postadress innan du kan logga in.");
            return;
        }

        navigate("/");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
            <motion.div
                className="w-full max-w-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="rounded-2xl shadow-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10">
                    <CardContent className="pt-8 px-6 sm:px-10 pb-10 flex flex-col gap-5 items-center text-center">

                        {/* Hero Section */}
                        <div className="text-center mb-1 space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-extrabold text-yellow-400 drop-shadow-sm">
                                HoleInOne.se
                            </h1>
                            <p className="text-white/70 text-xs sm:text-sm max-w-xs mx-auto leading-snug">
                                Avancerat turneringsverktyg för golfspelare.
                            </p>
                        </div>

                        <h2 className="text-xl sm:text-3xl font-extrabold tracking-wide text-white mt-2">
                            Logga in
                        </h2>

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
                        {errorMessage && (
                            <div className="w-full bg-red-600/90 text-white text-sm px-4 py-3 rounded-lg shadow text-left">
                                {errorMessage}
                            </div>
                        )}

                        <Button
                            onClick={handleLogin}
                            className="w-full text-base sm:text-lg py-3 sm:py-4 rounded-lg bg-green-500 hover:bg-green-400 font-semibold sm:font-bold tracking-wide shadow-md hover:shadow-green-500/40 transition-all duration-200"
                        >
                            Logga in
                        </Button>

                        <p className="text-xs sm:text-sm text-white/60 mt-1">
                            Har du inget konto?{" "}
                            <Link to="/register" className="text-green-400 font-medium hover:underline">
                                Registrera dig här
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
