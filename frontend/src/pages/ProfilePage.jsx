import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";
import MyInformationTab from "../components/profile/MyInformationTab.jsx";
import MyCardTab from "../components/profile/MyCardTab.jsx";

const TABS = [
  { key: "info", label: "My Information" },
  { key: "card", label: "My Card" },
];

const ProfilePage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Open "card" tab if ?tab=card is present in URL (from dashboard "View All")
  const initialTab = searchParams.get("tab") === "card" ? "card" : "info";
  const [activeTab, setActiveTab] = useState(initialTab);

  const switchTab = (key) => {
    setActiveTab(key);
    // Remove the ?tab query param so it doesn't linger on refresh
    setSearchParams({});
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[64px]">
        {/* Hero banner */}
        <div className="bg-[#2c3347] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute border border-white/30 rounded-full"
                style={{ width: `${(i + 1) * 180}px`, height: `${(i + 1) * 180}px`, top: "50%", right: "-3%", transform: "translate(0,-50%)" }} />
            ))}
          </div>
          <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 lg:py-12">
            <p className="text-[#a3b46a] text-xs font-semibold uppercase tracking-widest mb-4">Account</p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#6b7c3f] rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-white text-lg font-black">{initials}</span>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white leading-tight">{user?.fullName || "User"}</h1>
                <p className="text-gray-400 text-sm mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content card - WIDER (changed from max-w-3xl to max-w-5xl) */}
        <div className="max-w-5xl mx-auto px-6 -mt-4 relative z-10 pb-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100">
              {TABS.map((tab) => (
                <button key={tab.key} onClick={() => switchTab(tab.key)}
                  className={`flex-1 py-4 text-sm font-semibold transition-all relative ${activeTab === tab.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                    }`}>
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#6b7c3f] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-6 lg:p-8">
              {activeTab === "info" && <MyInformationTab />}
              {activeTab === "card" && <MyCardTab />}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;