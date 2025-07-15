import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import StartPage from "./pages/StartPage";
import NewTournament from "./pages/NewTournament";
import MyTournaments from "./pages/MyTournaments";
import Players from "./pages/MyPlayers";
import Tournament from "./pages/TournamentOverview/Content/Tournament";
import Header from "./components/header";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { AuthProvider } from "./hooks/useAuth";

function App() {
  return (
    <AuthProvider> {/* ✅ Wrap everything with AuthProvider */}
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/ny" element={<NewTournament />} />
          <Route path="/mina" element={<MyTournaments />} />
          <Route path="/spelare" element={<Players />} />
          <Route path="/turnering/:id" element={<Tournament />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
