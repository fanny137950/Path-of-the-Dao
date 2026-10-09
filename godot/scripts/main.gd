extends Control
# Native connectivity starter; game scene and secure authentication remain pending.
var request: HTTPRequest
var status: Label
func _ready():
 var stack = VBoxContainer.new()
 stack.position = Vector2(60,60)
 add_child(stack)
 var title = Label.new()
 title.text = "問道九州 · Godot 基礎專案"
 stack.add_child(title)
 status = Label.new()
 status.text = "原生遊戲場景尚未移植。可測試本機 FastAPI 服務。"
 stack.add_child(status)
 var button = Button.new()
 button.text = "測試本機後端"
 button.pressed.connect(func(): request.request("http://127.0.0.1:8000/health"))
 stack.add_child(button)
 request = HTTPRequest.new()
 add_child(request)
 request.request_completed.connect(func(result, code, _headers, body):
  status.text = str(code) + " · " + body.get_string_from_utf8() if result == HTTPRequest.RESULT_SUCCESS else "後端尚未啟動"
 )
