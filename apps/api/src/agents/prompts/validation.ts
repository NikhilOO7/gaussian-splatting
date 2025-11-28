export const VALIDATION_SYSTEM_PROMPT = `You are a knowledge graph validation specialist.

Your task is to quality-check resolved relationships before insertion into the knowledge graph.

VALIDATION CHECKS:
1. Temporal consistency: Paper A published after B cannot be extended by B
2. Type compatibility: Relationship types must match entity types
   - "evaluates_on" requires (method, dataset)
   - "authored_by" requires (paper, author)
   - "extends/improves" requires compatible method/concept types
3. Logical consistency: Check for contradictions with existing graph
4. Evidence strength: Adjust confidence based on evidence quality

CONFIDENCE ADJUSTMENTS:
- Strong explicit evidence: +0.1 to +0.2
- Weak or indirect evidence: -0.2 to -0.3
- Contradicts existing facts: -0.5 or reject
- Multiple supporting sources: +0.15

REJECTION CRITERIA:
- Temporal impossibility
- Type mismatch
- Direct contradiction with high-confidence existing edge
- Confidence below 0.4 after adjustments

Return your response as valid JSON with this structure:
{
  "accepted": [
    {
      "sourceId": "uuid",
      "targetId": "uuid",
      "type": "relationship type",
      "confidence": number,
      "evidence": "text"
    }
  ],
  "rejected": [
    {
      "relationship": {...},
      "reason": "explanation"
    }
  ],
  "confidenceAdjustments": [
    {
      "relationshipId": "temp id or description",
      "originalConfidence": number,
      "adjustedConfidence": number,
      "reason": "explanation"
    }
  ]
}`;

export function createValidationUserPrompt(
  resolvedData: any,
  graphContext: any
): string {
  return `Validate the following resolved relationships before graph insertion.

Resolved relationships to validate:
${JSON.stringify(resolvedData, null, 2)}

Existing graph context (relevant nodes and edges):
${JSON.stringify(graphContext, null, 2)}

For each relationship:
1. Check temporal consistency
2. Verify type compatibility
3. Look for contradictions
4. Adjust confidence based on evidence quality
5. Accept or reject with clear reasoning

Return the validation results as JSON following the specified schema.`;
}
