import { useState, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { EXECS, SHEETS_WEBHOOK } from '../../lib/constants';
import { formatAudience } from '../../lib/audience';

interface CheckoutStation {
  tipo: string;
  frequencia: string;
  municipio: string;
  uf: string;
  audience: number;
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  stations: CheckoutStation[];
}

type Step = 'form' | 'execs';

export default function CheckoutModal({ open, onClose, stations }: CheckoutModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', budget: '' });
  const [error, setError] = useState('');

  const kpis = useMemo(() => {
    const totalAud = stations.reduce((s, e) => s + e.audience, 0);
    const ufs = [...new Set(stations.map(e => e.uf))];
    return { count: stations.length, audience: totalAud, ufs: ufs.length };
  }, [stations]);

  const formatPhone = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    if (v.length > 2) return '(' + v.slice(0, 2) + ') ' + v.slice(2);
    return v;
  };

  const submit = () => {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push('Nome');
    if (!form.company.trim()) errs.push('Empresa');
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.push('Email válido');
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) errs.push('Telefone');
    if (!form.budget) errs.push('Orçamento');
    if (errs.length) { setError('Preencha: ' + errs.join(', ')); return; }
    setError('');

    // Send to Google Sheets
    try {
      fetch(SHEETS_WEBHOOK, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          source: 'HYPR Station — Radio Map',
          name: form.name.trim(), company: form.company.trim(),
          email: form.email.trim(), phone: form.phone,
          budget: form.budget, stations: kpis.count,
          audience: kpis.audience,
          ufs: [...new Set(stations.map(e => e.uf))].join(','),
          stationList: stations.slice(0, 20).map(s => s.frequencia + ' ' + s.municipio + '/' + s.uf).join('; '),
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {}

    setStep('execs');
  };

  const waMessage = useMemo(() => {
    const stList = stations.slice(0, 10).map(s => '- ' + s.frequencia + ' ' + s.municipio + '/' + s.uf).join('\n');
    return encodeURIComponent(
      'Olá! Sou ' + form.name + ' da ' + form.company + '.\n\n' +
      'Gostaria de ativar um plano de mídia rádio via HYPR.\n\n' +
      '*Resumo:*\n' + kpis.count + ' estações | ' + formatAudience(kpis.audience) + ' devices est.\n\n' +
      stList + (stations.length > 10 ? '\n... +' + (stations.length - 10) + ' estações' : '') +
      '\n\nOrçamento: ' + (form.budget || 'A definir')
    );
  }, [form, stations, kpis]);

  if (!open) return null;

  const inputCls = "w-full px-3 py-2 rounded-lg text-xs bg-[var(--bg-surface2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <div className="fixed inset-0 z-[3500] flex items-start justify-center p-5 overflow-y-auto
                    bg-[var(--overlay)]" style={{ backdropFilter: 'blur(4px)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-surface)] border-[0.5px] border-[var(--border)] rounded-[14px]
                      w-full max-w-[500px] mt-10 p-7 relative" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} aria-label="Fechar"
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--bg-surface2)]
                           text-[var(--text-muted)] hover:text-[var(--text-primary)]
                           flex items-center justify-center text-sm cursor-pointer transition-colors">
          ×
        </button>

        {/* KPIs */}
        <div className="text-center mb-5">
          <h3 className="font-heading text-lg font-bold text-[var(--text-primary)]">Montar plano</h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Revise a seleção e envie via WhatsApp</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { value: kpis.count.toString(), label: 'Estações' },
            { value: formatAudience(kpis.audience), label: 'Devices est.' },
            { value: kpis.ufs.toString(), label: 'UFs' },
          ].map(k => (
            <div key={k.label} className="bg-[var(--bg-surface2)] rounded-lg p-3 text-center">
              <div className="font-heading text-lg font-bold text-[var(--accent)]">{k.value}</div>
              <div className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Station list preview */}
        <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded-lg mb-5">
          {stations.sort((a, b) => b.audience - a.audience).slice(0, 30).map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] last:border-b-0 text-xs">
              <span className={`font-semibold ${s.tipo === 'FM' ? 'text-[var(--accent)]' : 'text-[var(--color-gold-400)]'}`}>
                {s.tipo}
              </span>
              <span className="text-[var(--text-primary)]">{s.frequencia} · {s.municipio}/{s.uf}</span>
              <span className="ml-auto text-[var(--accent)] text-[11px] font-medium">{formatAudience(s.audience)}</span>
            </div>
          ))}
        </div>

        {step === 'form' ? (
          <>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-3">
              Seus dados
            </div>
            <div className="grid gap-2 mb-4">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" className={inputCls} />
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Empresa" className={inputCls} />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputCls} />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="Telefone (DDD)" className={inputCls} />
              <select value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                      className={inputCls + ' cursor-pointer'}>
                <option value="">Orçamento estimado</option>
                <option value="Até R$10K">Até R$10K</option>
                <option value="R$10K–50K">R$10K–50K</option>
                <option value="R$50K–100K">R$50K–100K</option>
                <option value="R$100K+">R$100K+</option>
              </select>
            </div>
            {error && <p className="text-xs text-[var(--color-red-400)] text-center mb-3">{error}</p>}
            <button onClick={submit}
                    className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)]
                               font-heading font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity">
              Continuar
            </button>
          </>
        ) : (
          <>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-3">
              Escolha um executivo para contato via WhatsApp
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXECS.map(ex => (
                <a key={ex.phone} href={`https://wa.me/${ex.phone}?text=${waMessage}`}
                   target="_blank" rel="noopener"
                   className="flex items-center gap-2.5 p-3 rounded-lg bg-[var(--bg-surface2)]
                              border border-[var(--border)] hover:border-[var(--accent)]
                              transition-colors no-underline">
                  <img src={`/assets/${ex.img}`} alt={ex.name}
                       className="w-9 h-9 rounded-full object-cover shrink-0"
                       onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{ex.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Executivo HYPR</div>
                  </div>
                </a>
              ))}
            </div>
            <button onClick={onClose}
                    className="w-full mt-4 py-2 rounded-lg border border-[var(--border)]
                               text-xs text-[var(--text-muted)] hover:text-[var(--accent)]
                               cursor-pointer transition-colors">
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
