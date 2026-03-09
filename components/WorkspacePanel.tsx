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
    <div id={id} className="rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 rounded-t-xl overflow-hidden">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
