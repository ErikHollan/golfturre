import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const navigate = useNavigate();

    const handleRegister = async () => {
        const { data: authData, error: signupError } = await supabase.auth.signUp({
            email,
            password,
        });

        console.log("signupError", signupError)

        if (signupError) {
            alert("Registrering misslyckades: " + signupError.message);
            return;
        }

        console.error("authDsata:", authData);

        // ✅ Check for empty identities array
        if (!authData.user?.identities?.length) {
            alert("Den här e-postadressen används redan");
            return;
        }


        console.log("authData.user.id", authData.user.id)

        // ✅ Insert profile (auth session should now exist)
        const { error: insertError } = await supabase.from("users").insert([
            {
                user_id: authData.user.id,
                username: username,  // optional
            },
        ]);

        if (insertError) {
            console.error("Insert failed:", insertError);
            alert("insert failed", insertError)
        } else {
            alert("Registrering lyckades!");
            navigate("/")
        }


    };



    return (
        <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-center">📝 Registrera dig</h2>

            <input
                type="text"
                placeholder="Användarnamn"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mb-4 p-2 border rounded"
            />

            <input
                type="email"
                placeholder="E-post"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-4 p-2 border rounded"
            />

            <input
                type="password"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mb-6 p-2 border rounded"
            />

            <button
                onClick={handleRegister}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-semibold"
            >
                Skapa konto
            </button>
        </div>
    );
}
