import { ReactNode } from 'react';
import { Typography } from 'antd';

type PageShellProps = {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, subtitle, extra, back, children }: PageShellProps) {
  return (
    <section className="page-shell">
      {back ? <div className="page-back">{back}</div> : null}
      <div className="page-heading">
        <div>
          <Typography.Title level={3}>{title}</Typography.Title>
          {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
