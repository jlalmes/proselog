import { Dialog } from "@headlessui/react"
import { useRef, useState } from "react"
import ReactAvatarEditor from "react-avatar-editor"
import { getUserContentsUrl } from "~/lib/user-contents"
import { Avatar } from "~/components/ui/Avatar"
import { Button } from "~/components/ui/Button"
import toast from "react-hot-toast"
import createPica from "pica"
import { trpc } from "~/lib/trpc"
import { UploadFile, useUploadFile } from "~/hooks/useUploadFile"

const AvatarEditorModal: React.FC<{
  isOpen: boolean
  image?: File | null
  setIsOpen: (open: boolean) => void
  site?: string
  uploadFile: UploadFile
}> = ({ isOpen, setIsOpen, image, site, uploadFile }) => {
  const editorRef = useRef<ReactAvatarEditor | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const ctx = trpc.useContext()
  const updateProfile = trpc.useMutation("user.updateProfile")
  const updateSite = trpc.useMutation("site.update")

  const cropAndSave = async () => {
    if (!editorRef.current) return

    try {
      setIsSaving(true)

      // Get cropped image
      const fromCanvas = editorRef.current.getImage()
      const toCanvas = document.createElement("canvas")
      toCanvas.width = 460
      toCanvas.height = 460
      const pica = createPica()
      const result = await pica.resize(fromCanvas, toCanvas)
      const blob = await pica.toBlob(result, "image/jpeg", 0.9)

      // Upload image to R2
      const { key } = await uploadFile(blob, image!.name)

      // Save the image to profile / site
      if (site) {
        await updateSite.mutateAsync({ site, icon: key })
      } else {
        await updateProfile.mutateAsync({ avatar: key })
      }

      setIsOpen(false)
      toast.success("Updated!")
      ctx.invalidateQueries()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      className="fixed z-10 inset-0 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

        <div className="relative bg-white rounded-lg max-w-md w-full mx-auto">
          <Dialog.Title className="px-5 h-12 flex items-center border-b">
            Adjust the picture
          </Dialog.Title>

          <div className="py-5">
            {image && (
              <ReactAvatarEditor
                ref={editorRef}
                className="mx-auto rounded"
                image={image}
                borderRadius={9999}
              />
            )}
          </div>

          <div className="h-16 border-t flex items-center px-5">
            <Button isBlock onClick={cropAndSave} isLoading={isSaving}>
              Crop and Save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export const AvatarForm: React.FC<{
  filename: string | undefined | null
  name: string
  site?: string
}> = ({ filename, name, site }) => {
  const [isOpen, setIsOpen] = useState(false)
  const inputEl = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const uploadFile = useUploadFile()

  const onClick = () => {
    inputEl.current?.click()
  }

  const handleChange = (e: any) => {
    const files = e.target.files as File[]
    if (files.length > 0) {
      setImage(files[0])
      setIsOpen(true)
    }
  }

  return (
    <>
      <AvatarEditorModal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        image={image}
        site={site}
        uploadFile={uploadFile}
      />
      <input
        aria-hidden
        className="hidden"
        type="file"
        ref={inputEl}
        onChange={handleChange}
        accept="image/*"
      />
      <Avatar
        images={[getUserContentsUrl(filename)]}
        size={140}
        name={name}
        tabIndex={-1}
        className="cursor-default focus:ring-2 ring-offset-1 ring-zinc-200"
        onClick={onClick}
      />
    </>
  )
}
