import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AboutPage() {
  const { bootstrap } = useAuth();
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">About Aloms English Center</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">
        {bootstrap?.settings.aboutMission}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(bootstrap?.branches ?? []).map((b) => (
          <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="font-mono-tabular text-xs font-bold text-sky-700">{b.code}</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900">{b.name}</h2>
            <p className="mt-1 text-xs text-slate-600">{b.address}</p>
            <p className="font-mono-tabular mt-2 text-xs font-semibold text-slate-800">{b.phone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactPage() {
  const { bootstrap } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState(bootstrap?.branches[0]?.id || 'br-mirpur');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, branchId, message }),
    });
    if (res.ok) {
      setSent(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Contact Us</h1>
          <p className="mt-2 text-sm text-slate-600">
            Have questions about SSC/HSC English batches, IELTS mock tests, or branch admission?
            Reach out to our team.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-700">
            <p className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-sky-600" />
              <span className="font-mono-tabular">{bootstrap?.settings.phone}</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-sky-600" />
              <span>{bootstrap?.settings.email}</span>
            </p>
            <p className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-sky-600" />
              <span>{bootstrap?.settings.address}</span>
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
        >
          <h2 className="text-lg font-extrabold text-slate-900">Send an Inquiry</h2>
          {sent && (
            <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              Thank you! Our campus coordinator will contact you shortly.
            </p>
          )}
          <input
            type="text"
            required
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="tel"
              required
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          >
            {(bootstrap?.branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            required
            placeholder="Your message or course question..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#062436] py-3 text-sm font-bold text-white"
          >
            <Send className="h-4 w-4" />
            <span>Submit Inquiry</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export function PolicyPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
      <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-xs">
        <p>
          Aloms English Center maintains transparent academic, enrollment, privacy, and refund
          standards across all online courses and physical campuses.
        </p>
        <p>
          Course access is granted immediately upon online payment confirmation or upon Branch
          Manager approval for campus cash admissions. Digital e-books and accessed video modules
          are covered under our standard academic usage policy.
        </p>
        <p>
          For any billing, batch transfer, or guardian-link support, contact our support desk at{' '}
          <span className="font-mono-tabular font-bold">09617331133</span>.
        </p>
      </div>
    </div>
  );
}
