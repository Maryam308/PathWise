import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="min-h-screen pt-24 pb-16 bg-white flex items-center">
      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="flex flex-col gap-6 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight uppercase tracking-tight">
              Make Payments Easy, Simplify Your Finances
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed max-w-md">
              Track milestones, manage spending, and uncover insights for your future.
            </p>
            <div>
              <Link
                to="/signup"
                className="inline-block bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-semibold px-7 py-3.5 rounded-full transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                Get Started
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-10 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#6b7c3f" opacity="0.2" stroke="#6b7c3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">$10K+</p>
                  <p className="text-xs text-gray-500 font-medium">Goals Achieved</p>
                </div>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-2xl font-black text-gray-900">1200+</p>
                <p className="text-xs text-gray-500 font-medium">Active Users</p>
              </div>
            </div>
          </div>

          {/* Right - Card Visual */}
          <div className="relative flex items-center justify-center">
            {/* Beige circle background */}
            <div className="absolute w-96 md:w-[420px] h-96 md:h-[420px] bg-[#f0ebe3] rounded-full top-1/2 right-0 -translate-y-1/2" />

            {/* Cards image from Unsplash */}
            <div className="relative z-10">
              <img
                src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80"
                alt="Payment cards"
                className="w-96 md:w-[420px] h-auto object-cover rounded-2xl shadow-2xl rotate-6 hover:rotate-3 transition-transform duration-500"
              />
              {/* Floating card overlay */}
              <div className="absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 z-20">
                <div className="w-10 h-10 bg-[#6b7c3f] bg-opacity-10 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 17L9 11L13 15L21 7" stroke="#6b7c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Monthly savings</p>
                  <p className="text-sm font-bold text-gray-900">+$1,240.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;