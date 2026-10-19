'use client';

/**
 * Halaman proyek di area utama (P24-02): nama, catatan konteks, mulai konsultasi baru di proyek,
 * daftar konsultasinya. Proyek baru (`project === 'new'`) memakai bentuk yang sama. BELUM DIDESAIN (OQ-72).
 */
import type { ConversationSummary, ProjectDetail, ProjectSummary } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { createProject, deleteProject, updateProject } from './library-api';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export function ProjectView({
  project,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
  onNewConversation,
  onOpenConversation,
  formatDate,
}: {
  readonly project: ProjectDetail | 'new';
  readonly onCreated: (project: ProjectSummary) => void;
  readonly onUpdated: (project: ProjectSummary) => void;
  readonly onDeleted: (id: string) => void;
  readonly onCancel: () => void;
  readonly onNewConversation: (project: ProjectDetail) => void;
  readonly onOpenConversation: (conversation: ConversationSummary) => void;
  readonly formatDate: (iso: string) => string;
}) {
  const COPY = libraryCopy(useLocale().locale);
  const isNew = project === 'new';
  const [name, setName] = useState(isNew ? '' : project.name);
  const [notes, setNotes] = useState(isNew ? '' : (project.notes ?? ''));
  const [save, setSave] = useState<SaveState>('idle');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setName(project === 'new' ? '' : project.name);
    setNotes(project === 'new' ? '' : (project.notes ?? ''));
    setSave('idle');
    setConfirming(false);
  }, [project]);

  const dirty =
    isNew || name.trim() !== project.name || (notes.trim() || null) !== (project.notes ?? null);

  const submit = async () => {
    if (name.trim() === '') return;
    setSave('saving');
    const result = isNew
      ? await createProject(name.trim(), notes.trim() || null)
      : await updateProject(project.id, { name: name.trim(), notes: notes.trim() || null });
    if (result === null) {
      setSave('failed');
      return;
    }
    setSave('saved');
    if (isNew) onCreated(result);
    else onUpdated(result);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.kicker}>{COPY.projectKicker}</div>
        <input
          className={styles.nameInput}
          value={name}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
            setSave('idle');
          }}
          placeholder={COPY.namePlaceholder}
          aria-label={COPY.nameLabel}
          autoFocus={isNew}
        />

        <div className={styles.card}>
          <label className={styles.label} htmlFor="project-notes">
            {COPY.notesLabel}
          </label>
          <p className={styles.hint}>{COPY.notesHint}</p>
          <textarea
            id="project-notes"
            className={styles.notes}
            value={notes}
            maxLength={2000}
            onChange={(event) => {
              setNotes(event.target.value);
              setSave('idle');
            }}
            placeholder={COPY.notesPlaceholder}
          />
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void submit()}
              disabled={name.trim() === '' || !dirty || save === 'saving'}
            >
              {isNew ? COPY.create : COPY.save}
            </button>
            {isNew && (
              <button type="button" className={styles.secondary} onClick={onCancel}>
                {COPY.cancel}
              </button>
            )}
            {save === 'saved' && !isNew && <span className={styles.status}>{COPY.saved}</span>}
            {save === 'failed' && <span className={styles.statusError}>{COPY.saveFailed}</span>}
          </div>
        </div>

        {!isNew && (
          <>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => onNewConversation(project)}
              >
                <span aria-hidden="true">+</span>
                {COPY.newInProject}
              </button>
            </div>

            <div className={styles.card}>
              <div className={styles.label}>{COPY.projectConversations}</div>
              {project.conversations.filter((c) => c.title !== null).length === 0 ? (
                <p className={styles.hint}>{COPY.emptyProject}</p>
              ) : (
                <div className={styles.list}>
                  {project.conversations
                    .filter((c) => c.title !== null)
                    .map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={styles.listItem}
                        onClick={() => onOpenConversation(conversation)}
                      >
                        <span className={styles.listTitle}>{conversation.title}</span>
                        <span className={styles.listMeta}>
                          {formatDate(conversation.updatedAt)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className={styles.row}>
              {confirming ? (
                <>
                  <span className={styles.hint}>{COPY.deleteConfirm}</span>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() =>
                      void deleteProject(project.id).then((ok) => {
                        if (ok) onDeleted(project.id);
                      })
                    }
                  >
                    {COPY.deleteYes}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setConfirming(false)}
                  >
                    {COPY.cancel}
                  </button>
                </>
              ) : (
                <button type="button" className={styles.danger} onClick={() => setConfirming(true)}>
                  {COPY.deleteProject}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
