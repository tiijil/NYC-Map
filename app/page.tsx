import Image from "next/image";
import TaxiMap from './components/TaxiMap';

export default function Home() {
  return (
    <div className="h-screen w-full">
      <TaxiMap />
    </div>
  );
}
