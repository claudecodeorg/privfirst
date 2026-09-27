export interface Unit { id: string; label: string; /** Multiply by this to get the category's base unit. */ factor: number }
export interface Category { id: string; label: string; base: string; units: Unit[] }

const u = (id: string, label: string, factor: number): Unit => ({ id, label, factor });

export const categories: Category[] = [
  { id: 'length', label: 'Length', base: 'm', units: [
    u('mm', 'Millimetre', 0.001), u('cm', 'Centimetre', 0.01), u('m', 'Metre', 1), u('km', 'Kilometre', 1000),
    u('in', 'Inch', 0.0254), u('ft', 'Foot', 0.3048), u('yd', 'Yard', 0.9144), u('mi', 'Mile', 1609.344), u('nmi', 'Nautical mile', 1852)] },
  { id: 'mass', label: 'Mass', base: 'kg', units: [
    u('mg', 'Milligram', 1e-6), u('g', 'Gram', 0.001), u('kg', 'Kilogram', 1), u('t', 'Tonne', 1000),
    u('oz', 'Ounce', 0.028349523125), u('lb', 'Pound', 0.45359237), u('st', 'Stone', 6.35029318)] },
  { id: 'volume', label: 'Volume', base: 'L', units: [
    u('ml', 'Millilitre', 0.001), u('l', 'Litre', 1), u('m3', 'Cubic metre', 1000),
    u('tsp', 'Teaspoon (US)', 0.00492892159375), u('tbsp', 'Tablespoon (US)', 0.01478676478125), u('floz', 'Fluid ounce (US)', 0.0295735295625),
    u('cup', 'Cup (US)', 0.2365882365), u('pt', 'Pint (US)', 0.473176473), u('qt', 'Quart (US)', 0.946352946), u('gal', 'Gallon (US)', 3.785411784),
    u('galuk', 'Gallon (UK)', 4.54609)] },
  { id: 'area', label: 'Area', base: 'm²', units: [
    u('mm2', 'Square millimetre', 1e-6), u('cm2', 'Square centimetre', 1e-4), u('m2', 'Square metre', 1), u('ha', 'Hectare', 10000), u('km2', 'Square kilometre', 1e6),
    u('in2', 'Square inch', 0.00064516), u('ft2', 'Square foot', 0.09290304), u('ac', 'Acre', 4046.8564224), u('mi2', 'Square mile', 2589988.110336)] },
  { id: 'speed', label: 'Speed', base: 'm/s', units: [
    u('ms', 'Metre/second', 1), u('kmh', 'Kilometre/hour', 1 / 3.6), u('mph', 'Mile/hour', 0.44704), u('kn', 'Knot', 1852 / 3600), u('fps', 'Foot/second', 0.3048)] },
  { id: 'time', label: 'Time', base: 's', units: [
    u('ms_', 'Millisecond', 0.001), u('s', 'Second', 1), u('min', 'Minute', 60), u('h', 'Hour', 3600), u('d', 'Day', 86400), u('wk', 'Week', 604800),
    u('yr', 'Year (365.25 d)', 31557600)] },
  { id: 'data', label: 'Digital storage', base: 'B', units: [
    u('bit', 'Bit', 0.125), u('B', 'Byte', 1), u('KB', 'Kilobyte (1000)', 1e3), u('MB', 'Megabyte (1000²)', 1e6), u('GB', 'Gigabyte (1000³)', 1e9), u('TB', 'Terabyte (1000⁴)', 1e12),
    u('KiB', 'Kibibyte (1024)', 1024), u('MiB', 'Mebibyte (1024²)', 1024 ** 2), u('GiB', 'Gibibyte (1024³)', 1024 ** 3), u('TiB', 'Tebibyte (1024⁴)', 1024 ** 4)] },
  { id: 'energy', label: 'Energy', base: 'J', units: [
    u('j', 'Joule', 1), u('kj', 'Kilojoule', 1000), u('cal', 'Calorie (small)', 4.184), u('kcal', 'Kilocalorie', 4184), u('wh', 'Watt-hour', 3600), u('kwh', 'Kilowatt-hour', 3.6e6),
    u('btu', 'BTU (IT)', 1055.05585262)] },
  { id: 'pressure', label: 'Pressure', base: 'Pa', units: [
    u('pa', 'Pascal', 1), u('kpa', 'Kilopascal', 1000), u('bar', 'Bar', 1e5), u('atm', 'Atmosphere', 101325), u('psi', 'PSI', 6894.757293168), u('mmhg', 'mmHg', 133.322387415)] },
  { id: 'temperature', label: 'Temperature', base: '°C', units: [u('c', 'Celsius', 1), u('f', 'Fahrenheit', 1), u('k', 'Kelvin', 1)] },
];

const toCelsius: Record<string, (v: number) => number> = { c: (v) => v, f: (v) => ((v - 32) * 5) / 9, k: (v) => v - 273.15 };
const fromCelsius: Record<string, (v: number) => number> = { c: (v) => v, f: (v) => (v * 9) / 5 + 32, k: (v) => v + 273.15 };

export function convert(category: Category, from: string, to: string, value: number): number {
  const a = category.units.find((x) => x.id === from);
  const b = category.units.find((x) => x.id === to);
  if (!a || !b) throw new Error(`Unknown unit in ${category.id}`);
  if (category.id === 'temperature') return fromCelsius[to](toCelsius[from](value));
  return (value * a.factor) / b.factor;
}

/** Up to 10 significant digits, without float noise like 0.30000000000000004; large/small values use exponent form. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-7) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return String(Number(n.toPrecision(10)));
}
