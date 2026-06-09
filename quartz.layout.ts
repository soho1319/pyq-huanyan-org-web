import { FullSlug, getAllSliugs } from "./quartz/util/path"
import { Layout } from "./quartz/util/layout"
import { FilePath, JOIN } from "./quartz/util/path"
import { QuartzComponent } from "./quartz/components/types"
import { GlobalDrawer } from "./quartz/components"
import PromptToolbox from "./components/PromptToolbox"

export default (() => {
 const head: QuartzComponent = PromptToolbox() //注入工具箱脚本

 return {
 head,
 header: [],
 beforeBody: [],
 pageBody: [],
 afterBody: [],
 footer: [],
 }
}) satisfies Layout
