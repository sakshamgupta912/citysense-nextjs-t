// components/Spinner.tsx
export default function Spinner() {
  return (
    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-cyan-500 to-orange-500 rounded-full animate-spin mb-4">
              <div className="w-8 h-8 bg-white rounded-full"></div>
            </div>
  );
}
