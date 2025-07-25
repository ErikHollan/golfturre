import React, { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";
import { BoltIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function StartPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10">
          <CardContent className="pt-10 px-6 sm:px-10 pb-12 flex flex-col gap-8 items-center text-center">

            {/* Logo + Headline */}
            <div className="flex flex-col items-center gap-2">
              <img
                src="https://yswafknmqpwjrsxjslbu.supabase.co/storage/v1/object/public/logos//logosmall.png"
                alt="Logo"
                className="w-12 h-12  brightness-125"
              />
              <p className="text-white/70 text-sm sm:text-base max-w-xs mt-1 leading-snug text-center">
                Skapa, hantera och följ turneringar.
              </p>
            </div>


            {/* Action Buttons */}
            <div className="flex flex-col gap-4 w-full text-white mt-2">
              <Button
                onClick={() => navigate('/ny')}
                className="w-full text-sm sm:text-lg py-3 sm:py-4 rounded-xl bg-green-500 hover:bg-green-400 font-bold tracking-wide shadow-lg hover:shadow-green-500/40 transition-all duration-200"
              >
                ⛳ Skapa ny turnering
              </Button>

              <Button
                onClick={() => navigate('/mina')}
                className="w-full text-sm sm:text-lg py-3 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-white/10 hover:from-green-600 hover:to-green-500 hover:text-white shadow-md transition-all duration-200"
              >
                📁 Mina turneringar
              </Button>

              <Button
                onClick={() => navigate('/spelare')}
                className="w-full text-sm sm:text-lg py-3 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-white/10 hover:from-purple-600 hover:to-purple-500 hover:text-white shadow-md transition-all duration-200"
              >
                👥 Spelarhantering
              </Button>
            </div>

            {/* Footer */}
            <p className="text-[10px] sm:text-xs text-white/40 mt-4 tracking-wide">
              © {new Date().getFullYear()} HoleInOne.se – En tjänst från Hollander web
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
