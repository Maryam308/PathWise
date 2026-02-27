const WhoWeAre = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[0.3em] text-gray-400 uppercase font-medium mb-3">
                W h o &nbsp; W e &nbsp; A r e
              </p>
              <h2 className="text-4xl font-black text-gray-900 leading-tight">
                Who We Are
              </h2>
            </div>

            <p className="text-gray-500 leading-relaxed">
              Established in 2022, PathWise has been dedicated to helping individuals
              take control of their financial journey. Our mission started with a simple
              idea: make financial planning accessible to everyone. Today, we continue
              to turn financial dreams into reality.
            </p>

            <div className="flex gap-8 pt-2">
              <div>
                <p className="text-2xl font-black text-gray-900">3+</p>
                <p className="text-sm text-gray-500">Years Experience</p>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900">50K+</p>
                <p className="text-sm text-gray-500">Transactions Tracked</p>
              </div>
            </div>

            {/* Image */}
            <div className="mt-4 rounded-2xl overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80"
                alt="Finance app on mobile"
                className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>

          {/* Right - Why Us */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[0.3em] text-gray-400 uppercase font-medium mb-3">
                W h y &nbsp; U s
              </p>
              <h2 className="text-4xl font-black text-gray-900 leading-tight">
                Why Us
              </h2>
            </div>

            <p className="text-gray-500 leading-relaxed">
              What makes us unique is our unwavering commitment to excellence.
              We're not just a finance app; we're your trusted financial companion.
              Discover the reasons why thousands choose PathWise to manage their money.
            </p>

            <div className="flex flex-col gap-4 pt-2">
              {[
                { icon: "📊", title: "Real-time Insights", desc: "Get live analytics on your spending patterns and habits." },
                { icon: "🎯", title: "Goal Tracking", desc: "Set, track, and achieve your financial milestones." },
                { icon: "🔒", title: "Bank-level Security", desc: "Your data is protected with enterprise-grade encryption." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Image */}
            <div className="mt-2 rounded-2xl overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80"
                alt="Financial charts and analytics"
                className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhoWeAre;