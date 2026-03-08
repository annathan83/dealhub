type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional action (e.g. Download button) in header */
  action?: React.ReactNode;
};

export default function WorkspacePanel({ id, title, subtitle, children, action }: Props) {
  return (
    <div id={id} className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-50">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
