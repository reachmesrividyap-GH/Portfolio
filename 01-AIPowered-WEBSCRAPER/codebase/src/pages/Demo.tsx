import { NeonOrbs } from '@/components/ui/neon-orbs';

export default function DemoOne() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <NeonOrbs />
      <div className="relative z-10 text-center">
        <h1 className="text-6xl font-bold mb-4 text-white">Neon Orbs Demo</h1>
        <p className="text-xl text-gray-300">Beautiful animated background with glowing orbs</p>
      </div>
    </div>
  );
}
