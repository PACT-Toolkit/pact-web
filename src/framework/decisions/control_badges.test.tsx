import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionControlBadges } from '@/src/framework/decisions/control_badges';

describe('DecisionControlBadges', () => {
  it('renders one badge per control with the framework label', () => {
    render(
      <DecisionControlBadges
        data-testid="badges"
        controls={[
          { framework: 'owasp_llm_top10', id: 'LLM01' },
          { framework: 'eu_ai_act_art15', id: 'accuracy' },
          { framework: 'iso_42001', id: 'A.6' },
        ]}
      />
    );

    const badges = screen.getByTestId('badges');
    expect(badges).toHaveTextContent('OWASP LLM01');
    expect(badges).toHaveTextContent('AI Act Art. 15 accuracy');
    expect(badges).toHaveTextContent('iso_42001 A.6');
    expect(badges.querySelectorAll('code')).toHaveLength(3);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(
      <DecisionControlBadges data-testid="badges" controls={[]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
