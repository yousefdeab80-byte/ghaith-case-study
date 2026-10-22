export function FilterSelect({ name, label, value, options, all = "الكل" }: { name: string; label: string; value?: string; options: [string, string][]; all?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">{all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
