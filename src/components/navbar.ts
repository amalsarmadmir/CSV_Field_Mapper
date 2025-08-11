import React from "react";

export default function CurvedNavbar({ step }: { step: number }) {
  const icons = [
    { id: 0, svg: <ThreeLines /> },
    { id: 1, svg: <Stack /> },
    { id: 2, svg: <Inbox /> },
    { id: 3, svg: <Grid /> },
    { id: 4, svg: <ImageIcon /> },
  ];

  return (
    <div className="flex justify-center w-full py-6">
      <div className="relative flex justify-around items-center w-full max-w-xl h-20 bg-gray-900 rounded-t-3xl px-4">
        {icons.map((icon, idx) => {
          const isActive = icon.id === step;
          return (
            <div
              key={icon.id}
              className={`${
                isActive
                  ? "absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center shadow-xl z-10"
                  : "text-white"
              }`}
            >
              {!isActive && <div>{icon.svg}</div>}
              {isActive && <div className="text-white">{icon.svg}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Icons
const ThreeLines = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const Stack = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 2l10 5-10 5L2 7l10-5zm0 13l10-5M2 12l10 5 10-5" />
  </svg>
);

const Inbox = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M3 13h18v-2H3v2zm0 0v5a2 2 0 002 2h14a2 2 0 002-2v-5M7 13V7h10v6" />
  </svg>
);

const Grid = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect width="6" height="6" x="3" y="3" rx="1" />
    <rect width="6" height="6" x="15" y="3" rx="1" />
    <rect width="6" height="6" x="3" y="15" rx="1" />
    <rect width="6" height="6" x="15" y="15" rx="1" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect width="18" height="14" x="3" y="5" rx="2" />
    <circle cx="8" cy="8" r="1.5" />
    <path d="M21 19l-5-6-4 5-3-4-5 6" />
  </svg>
);
