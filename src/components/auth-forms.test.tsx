import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/conta/actions", () => ({ signInAction: vi.fn(), signUpAction: vi.fn() }));

import { AuthForms } from "./auth-forms";

describe("AuthForms", () => {
  it("preserves model registration intent for both sign-in and signup", () => {
    const markup = renderToStaticMarkup(<AuthForms returnToModelRegistration />);

    expect(markup.match(/name="destination" value="maker-model-registration"/g)).toHaveLength(2);
  });
});
