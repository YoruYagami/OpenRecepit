import React, { useState } from "react";
import { Field, TextInput } from "../ui/Input.jsx";
import { PrimaryButton } from "../ui/Button.jsx";
import { Icon } from "../ui/Icon.jsx";

/*
 * Trip create/edit form body — rendered inside an <Overlay variant="sheet">.
 * Mounted fresh per open (overlay descriptors are pushed per interaction), so
 * initial values are plain useState initializers.
 */
export function TripFormBody({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [city, setCity] = useState(initial?.city || "");
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");

  const rangeInvalid = !!(startDate && endDate && endDate < startDate);
  const canSave = name.trim().length > 0 && !rangeInvalid;

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
    <form onSubmit={submit} className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-extrabold text-ink">
          {initial ? "Modifica trasferta" : "Nuova trasferta"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="w-9 h-9 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
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
            <TextInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Data fine">
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {rangeInvalid && (
          <p className="text-xs font-semibold text-danger">
            La data di fine è precedente a quella di inizio.
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-surface-2 text-ink font-semibold active:scale-[0.98]"
        >
          Annulla
        </button>
        <PrimaryButton type="submit" disabled={!canSave} className="flex-1">
          {initial ? "Salva" : "Crea"}
        </PrimaryButton>
      </div>
    </form>
  );
}
