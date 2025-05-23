import type { Meta, StoryObj } from '@storybook/angular';
import { AuthContainerComponent } from './auth-container.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<AuthContainerComponent> = {
  component: AuthContainerComponent,
  title: 'AuthContainerComponent',
};
export default meta;
type Story = StoryObj<AuthContainerComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/auth-container works!/gi)).toBeTruthy();
  },
};
