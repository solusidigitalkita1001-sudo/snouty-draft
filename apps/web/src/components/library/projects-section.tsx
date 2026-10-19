'use client';

/** Bagian PROYEK di sidebar (P24-02): daftar proyek + tombol proyek baru. BELUM DIDESAIN (OQ-72). */
import type { ProjectSummary } from '@snouty/shared-types';
import { useLocale } from '../locale';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

export function ProjectsSection({
  projects,
  activeId,
  sectionClass,
  onOpen,
  onNew,
}: {
  readonly projects: readonly ProjectSummary[];
  readonly activeId: string | null;
  /** Kelas judul bagian dari sidebar (label mono yang sama dengan RIWAYAT). */
  readonly sectionClass: string;
  readonly onOpen: (id: string) => void;
  readonly onNew: () => void;
}) {
  const COPY = libraryCopy(useLocale().locale);
  return (
    <>
      <div className={styles.sectionHead}>
        <div className={sectionClass}>{COPY.projectsTitle}</div>
        <button
          type="button"
          className={styles.sectionAdd}
          onClick={onNew}
          aria-label={COPY.newProject}
          title={COPY.newProject}
        >
          +
        </button>
      </div>
      {projects.length === 0 && <p className={styles.empty}>{COPY.noProjects}</p>}
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          className={[styles.projectItem, project.id === activeId ? styles.projectItemOn : ''].join(
            ' ',
          )}
          onClick={() => onOpen(project.id)}
          aria-current={project.id === activeId ? 'page' : undefined}
        >
          <svg
            className={styles.projectIcon}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.projectName}>{project.name}</span>
          {project.conversationCount !== undefined && project.conversationCount > 0 && (
            <span className={styles.projectCount}>{project.conversationCount}</span>
          )}
        </button>
      ))}
    </>
  );
}
