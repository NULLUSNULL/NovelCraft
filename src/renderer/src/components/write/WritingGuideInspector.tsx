import { CheckSquare, Target } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { DocumentNode } from '@shared/types'
import { Field } from '../ui/Form'
import { WritingGuideChecklist } from './WritingGuideChecklist'

function TensionSection({ node }: { node: DocumentNode }) {
  const updateNode = useAppStore((state) => state.updateNode)
  return (
    <section className="inspector-section">
      <div className="inspector-section-head">
        <Target size={13} />
        <h3>Tensión dramática</h3>
      </div>
      <div className="inspector-fields">
        <Field label="Objetivo de la escena">
          <textarea
            className="textarea sm"
            value={node.goal}
            onChange={(event) => updateNode(node.id, { goal: event.target.value })}
            rows={2}
            placeholder="Qué busca el personaje"
          />
        </Field>
        <Field label="Conflicto">
          <textarea
            className="textarea sm"
            value={node.conflict}
            onChange={(event) => updateNode(node.id, { conflict: event.target.value })}
            rows={2}
            placeholder="Qué se opone"
          />
        </Field>
        <Field label="Resultado">
          <textarea
            className="textarea sm"
            value={node.outcome}
            onChange={(event) => updateNode(node.id, { outcome: event.target.value })}
            rows={2}
            placeholder="Qué cambia al final"
          />
        </Field>
        <Field label="Tensión dramática">
          <textarea
            className="textarea sm"
            value={node.dramaticTension || ''}
            onChange={(event) => updateNode(node.id, { dramaticTension: event.target.value })}
            rows={2}
            placeholder="Qué aumenta la tensión y qué está en riesgo"
          />
        </Field>
        <Field label="Esquema de escritura">
          <textarea
            className="textarea sm"
            value={node.writingPlan || ''}
            onChange={(event) => updateNode(node.id, { writingPlan: event.target.value })}
            rows={4}
            placeholder="Pasos o beats para desarrollar la escena"
          />
        </Field>
      </div>
    </section>
  )
}

export function WritingGuideInspector() {
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const node = project && selectedDocumentId ? project.nodes[selectedDocumentId] : undefined
  const isScene = node?.type === 'scene'
  return (
    <div className="inspector-scroll">
      {isScene && node ? (
        <TensionSection node={node} />
      ) : (
        <p className="form-empty-text">
          Selecciona una escena para ver la tensión dramática de tu historia.
        </p>
      )}
      <section className="inspector-section">
        <div className="inspector-section-head">
          <CheckSquare size={13} />
          <h3>Puntos de escritura</h3>
        </div>
        <WritingGuideChecklist />
      </section>
    </div>
  )
}
