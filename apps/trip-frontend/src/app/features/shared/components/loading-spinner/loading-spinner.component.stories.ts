import type { Meta, StoryObj } from '@storybook/angular';
import { LoadingSpinnerComponent } from './loading-spinner.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<LoadingSpinnerComponent> = {
  component: LoadingSpinnerComponent,
  title: 'LoadingSpinnerComponent',
};
export default meta;
type Story = StoryObj<LoadingSpinnerComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/loading-spinner works!/gi)).toBeTruthy();
  },
};
