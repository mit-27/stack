import { listEmailTemplatesWithDefault } from "@/lib/email-templates";
import { createCrudHandlers } from "@/route-handlers/crud-handler";
import { listEmailTemplatesCrud } from "@stackframe/stack-shared/dist/interface/crud/email-templates";

export const listEmailTemplatesCrudHandlers = createCrudHandlers(listEmailTemplatesCrud, {
  paramNames: [],
  async onRead({ auth }) {
    return await listEmailTemplatesWithDefault(auth.project.id);
  },
});
