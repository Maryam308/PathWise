import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";
import Hero from "../components/landing/Hero.jsx";
import WhoWeAre from "../components/landing/WhoWeAre";

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <WhoWeAre />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;