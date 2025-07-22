import React, { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";
import { BoltIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function StartPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth(); // ✅ using loading

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) return null; // or show a spinner

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10">
          <CardContent className="pt-10 px-10 pb-12 flex flex-col gap-8 items-center text-center">
            {/* Header */}
            <div className="flex flex-col items-center animate-pulse">
              <BoltIcon className="text-yellow-400 w-10 h-10 drop-shadow-[0_0_4px_#facc15]" />
              <div className="flex items-center gap-4">

              </div>
              <p className="text-sm text-white opacity-80 italic mt-2 text-center">
                Verktyget för dina golfturneringar
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-4 w-full text-white">
              {/* Primary Action */}
              <Button
                onClick={() => navigate('/ny')}
                className="w-full text-base sm:text-lg md:text-xl py-4 sm:py-5 rounded-xl bg-green-500 hover:bg-green-400 font-bold tracking-wide sm:tracking-wider shadow-lg hover:shadow-green-500/40 transition-all duration-200"
              >
                Skapa ny turnering
              </Button>

              {/* Secondary Buttons */}
              <Button
                onClick={() => navigate('/mina')}
                className="w-full text-lg py-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-white/10 text-white hover:from-green-600 hover:to-green-500 hover:text-white hover:shadow-md transition-all duration-200"
              >
                📁 Mina turneringar
              </Button>

              <Button
                onClick={() => navigate('/spelare')}
                className="w-full text-lg py-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-white/10 text-white hover:from-purple-600 hover:to-purple-500 hover:text-white hover:shadow-md transition-all duration-200"
              >
                👥 Spelarhantering
              </Button>
            </div>


            {/* Footer */}
            <p className="text-xs text-white/40 mt-4 tracking-wider">
              Powered by Hollander web™
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
