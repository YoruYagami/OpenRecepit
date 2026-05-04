import React, { useState, useEffect } from 'react';
import { Field, TextInput } from '../ui/Input.jsx';
import { PrimaryButton } from '../ui/Button.jsx';

export function TripFormModal({ open, initial, onClose, onSave }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setCity(initial?.city || "");
      setStartDate(initial?.startDate || "");
      setEndDate(initial?.endDate || "");
    }
  }, [open, initial]);

  if (!open) return null;

  const canSave = name.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      name: name.trim(),
      city: city.trim(),
      startDate,
      endDate,
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-soft-lg p-6 fade-in"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-ink">{initial ? "Modifica trasferta" : "Nuova trasferta"}</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-black/5 grid place-items-center text-ink/60">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Cliente Milano"
            />
          </Field>
          <Field label="Città">
            <TextInput
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Es. Milano"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data inizio">
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Data fine">
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-black/5 text-ink font-semibold active:scale-[0.98]"
          >
            Annulla
          </button>
          <PrimaryButton type="submit" disabled={!canSave} className="flex-1">
            {initial ? "Salva" : "Crea"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
