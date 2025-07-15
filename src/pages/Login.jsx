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
    const { user, loading } = useAuth(); // ✅ get user and loading state

    // ✅ Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            navigate("/");
        }
    }, [user, loading, navigate]);

    const handleLogin = async () => {
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (loginError) {
            console.log("LOGINERROR", loginError);

            if (loginError.message && loginError.message.includes("Email not confirmed")) {
                alert("Du måste bekräfta din e-postadress innan du kan logga in.");
            } else {
                alert("Fel inloggning. Kontrollera e-post och lösenord.");
            }

            return;
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            alert("Kunde inte hämta användardata.");
            console.error(userError);
            return;
        }

        if (!user.email_confirmed_at) {
            alert("Du måste bekräfta din e-postadress innan du kan logga in.");
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
                <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10">
                    <CardContent className="pt-10 px-10 pb-12 flex flex-col gap-6 items-center text-center">
                        <h2 className="text-3xl font-extrabold tracking-wide text-white mb-6">
                            🔐 Logga in
                        </h2>

                        <input
                            type="email"
                            placeholder="E-post"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />

                        <input
                            type="password"
                            placeholder="Lösenord"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />

                        <Button
                            onClick={handleLogin}
                            className="w-full text-lg py-4 rounded-xl bg-green-500 hover:bg-green-400 font-bold tracking-wider shadow-lg hover:shadow-green-500/40 transition-all duration-200"
                        >
                            Logga in
                        </Button>

                        <p className="text-sm text-white/60 mt-4">
                            Har du inget konto?{" "}
                            <Link to="/register" className="text-green-400 font-medium hover:underline">
                                Registrera dig här
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );

}
